import { callAiCore } from './ai-core-service';
import { aiPolicy } from './ai-policy';
import { buildRepoSnapshot, applyPatchToRepo } from './system-ai-repo-utils';
import { writeSystemAiAudit } from './system-ai-audit';
import { runProjectTests, type TestRunResult } from './system-ai-tests';
import { systemAiState } from './system-ai-state';

export interface SystemAiProposalInput {
  command: string;
  contextFiles?: string[];
  userId?: string | null;
}

export interface CodePatch {
  id: string;
  filePath: string;
  oldCode: string;
  newCode: string;
  summary: string;
}

export interface SystemAiProposalResult {
  command: string;
  patches: CodePatch[];
}

export interface SystemAiApproveInput {
  patchId: string;
}

export async function proposeSystemAiChanges(
  input: SystemAiProposalInput
): Promise<SystemAiProposalResult> {
  if (systemAiState.paused) {
    throw new Error('System AI is paused by creator');
  }

  const { command, contextFiles, userId } = input;
  const policy = aiPolicy.systemAi;

  const snapshot = await buildRepoSnapshot({
    includeGlobs: contextFiles ?? policy.snapshot.includeGlobs,
    maxFiles: policy.snapshot.maxFiles,
    maxCharsPerFile: policy.snapshot.maxCharsPerFile,
  });

  const prompt = `
You are the System AI for NeuroCore. You allow a non-coder user to modify the system using simple natural language.

USER COMMAND: "${command}"

CONTEXT:
The user does not know how to code. You must identify the files to change and provide the EXACT block of code to replace.

INSTRUCTIONS:
1. Analyze the REPO SNAPSHOT below.
2. Identify the specific file(s) that need changing to satisfy the command.
3. Extract the *exact* snippet of existing code (oldCode) that needs to be removed.
4. Write the new code (newCode) that should replace it.
5. Return a JSON object with a "patches" array.

CONSTRAINTS:
- "oldCode" must match the file content EXACTLY (character for character), or the patch will fail.
- Do not hallucinate code that isn't there.
- Keep changes minimal and focused.
- For each patch, you MUST return: id, filePath, oldCode, newCode, summary.
- Never apply changes yourself; only describe patches.

REPO SNAPSHOT (truncated):
${snapshot}

Return JSON ONLY (no markdown):
{
  "patches": [
    {
      "id": "patch_1",
      "filePath": "src/path/to/file.tsx",
      "oldCode": "original code block exactly as it appears in snapshot",
      "newCode": "new code block",
      "summary": "Explanation for the user"
    }
  ]
}
  `.trim();

  const result = await callAiCore({
    role: 'system',
    prompt,
  });

  let patches: CodePatch[] = [];
  if (result.status === 'success') {
    try {
      const jsonMatch = result.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.patches)) {
          patches = parsed.patches
            .slice(0, policy.maxPatches)
            .filter((p: any) => p.filePath && p.oldCode && p.newCode)
            .map((p: any) => ({
              ...p,
              newCode:
                p.newCode.length > policy.maxNewCodeChars
                  ? p.newCode.slice(0, policy.maxNewCodeChars)
                  : p.newCode,
            }));
        }
      }
    } catch {
      patches = [];
    }
  }

  writeSystemAiAudit({
    type: 'proposal_created',
    userId: userId ?? null,
    command,
    patchCount: patches.length,
    timestamp: new Date().toISOString(),
  });

  return {
    command,
    patches,
  };
}

export async function approveSystemAiPatch(
  patch: CodePatch,
  opts?: { userId?: string | null; command?: string }
): Promise<{ ok: boolean; appliedFile: string; tests?: TestRunResult }> {
  await applyPatchToRepo({
    filePath: patch.filePath,
    oldCode: patch.oldCode,
    newCode: patch.newCode,
  });

  writeSystemAiAudit({
    type: 'patch_approved',
    userId: opts?.userId ?? null,
    patchId: patch.id,
    filePath: patch.filePath,
    command: opts?.command ?? '',
    timestamp: new Date().toISOString(),
  });

  const tests = await runProjectTests();

  systemAiState.lastTestExitCode = tests.exitCode;
  systemAiState.lastTestAt = new Date().toISOString();

  return { ok: true, appliedFile: patch.filePath, tests };
}
