# Improvement plan, from the assessment of 2026-11-21

This is the plan that follows an assessment of how Jig's roles and models communicate: whether the way is general, correct and extensible, and close to how the large providers do it (the author's criterion: "que lo que tengamos sea general y correcto y extensible, preferentemente no alejado de como se implementa en los proveedores exitosos"). It is written to be implemented item by item, by the author or by an agent, without the conversation that produced it.

Nothing in this plan is built, except a small helper on the branch `wip/output-schema` (phase B says what it is). The code it describes is `main` at commit 337c820.

## How to work through it

- Read the repository's own rules first: `CONTRIBUTING.md`, the principles in `docs/FOUNDATIONS.md`, and `docs/design/2026-11/CONCEPT.md` section 8, where what is left lives. This plan adds to that section and does not replace it.
- One item, one commit, with its test in the same commit. A test must fail without the change: check it by stashing the change once.
- A fix is general or it is not made: nothing is fitted to a task, a task set, a model name or a topology id (FOUNDATIONS, "a task is solved by the harness working well, never by knowing the task").
- Live runs go through Ollama only (the author, 2026-11-21: "no hagas pruebas con APIs, hazlas con Ollama para no gastar"). Cloud providers are tested against fake servers that answer as the real API documents; an item that could not be checked against the real service says so in its commit and in the CHANGELOG.
- Every number written in a doc or a commit comes from a run or a test, named beside it.
- The recorded runs of 2026-11-20 are a free corpus of real replies: `benchmark-results/2026-11-20/p5/out-*/runs/*/steps.json` on the author's machine (git ignores it). Parsers and prompts can be checked against them without a model call. Phase F turns a sample of them into fixtures in the repository.
- The full suite can time out a few console tests at 5 s when every workspace runs at once; they pass when the console's suite runs alone.
- Phases are ordered by what they protect: A makes what exists honest, B gives decisions a real interface, C makes each topology do what its description says, D makes the provider layer general, E is the author's request for benchmark data, F keeps all of it from regressing. A and B do not depend on the author's decisions; parts of C do (section "Decisions for the author").

## What the assessment found sound

Checked by two independent reviews of the code (one of the engine and the roles, one of the provider layer), each with scratch tests against the real code, and by reading the step records of the recorded runs.

- The model: typed signals over wires, each role seeing only what its wires and its definition give it, with provenance on every field. This is the family the field has moved to (typed handoffs and declared inputs and outputs, as in OpenAI's Agents SDK, AutoGen 0.4's typed messages and Agent Spec's flows), and Jig needs it for its own thesis, since what a role saw can only be measured where it is explicit.
- Signal delivery in rounds: pending signals are taken at a turn's start, ports check types, a wire's `fields` are enforced, roles upstream of a way back's target do not run again, and no signal was found lost or delivered twice.
- Walls: no shared recent signals or blackboard, each role builds its own messages, Critique and Decide get counts only.
- Measured checks: they run in a fresh copy with the check files restored, and the measured verdict wins over the model's. In the recorded runs Check's model disagreed with the measured check in 9 of 366 turns, and the measurement decided all nine.
- Failures: a thrown provider error, a tool cap or a timeout fails the run loudly; an abort or a spent budget is not counted as a failure; Check's unparsed verdict never passes. No loop without a bound was found.
- Providers: the round trip of a conversation (text, two tool calls, two results, a follow-up) is right in order and ids on all four paths (Anthropic, OpenAI Responses, Chat Completions, Ollama). What one provider keeps for itself (`providerContent`, `providerItems`, `echo`) never reaches another. Keys of the OpenAI kinds go only to their entry's host, and discovery asks only 127.0.0.1.

## What is wrong, in one page

1. **The interface is typed at the envelope and not at the payload.** Check, Critique, Decide and Memory answer in JSON that Jig validates; Plan answers in prose read by a regular expression that takes `STRATEGY: stop` and not `**STRATEGY**: stop`. In the recorded runs, 25 of 335 planner turns wrote stop, pivot or escalate and were read as continue, and the next task was rarely read, so Do got the whole plan as its task. And where JSON is asked for, it is asked in words: no provider's structured output is used.
2. **An unreadable reply becomes a decision.** An empty reply makes Decide say "refine", Critique say "ok" and Plan hand over an empty plan, each as a success. Check alone treats it honestly.
3. **A failed check can tell Do the expected answer.** The `file` and `answer` check kinds print `expected equal to "<value>"`, and that output reaches Check's prompt, the corrections and Do's next prompt. It contradicts FOUNDATIONS ("never what it expected"). The benchmark's own sets use `command` checks that print no value, so the published numbers are not affected.
4. **Several topologies do not carry what their descriptions say.** Full Agent Pipeline has no wire from Check's corrections to Do; Plan & Execute and Supervised Coder hand Do the next task and never the plan; Reflexion's memory says nothing below three signals; Adversarial Duel runs its two sides one after another in one workspace, so the second reads the first's file; Critique cannot change Deep Reasoning's course; Decide decides between "refine" and "start over" from a pass rate that with one check is 0 or 100.
5. **Outcomes that do not follow from a measurement.** The Ralph Loop reports passed when PLAN.md's boxes are ticked, and Do ticks them; a model writing "stop" or "abort" ends the run as stopped and the measured check is skipped; a crashed Do can still be passed when the check passes on the untouched workspace.
6. **The provider layer has holes at its edges.** A cut or timed-out stream on Chat Completions is returned as a complete answer; a timeout after streamed text falls back and shows text twice; the refusal learner learns from an invalid value and never unlearns; Ollama's 5xx is never retried; and six smaller ones (phase A).

## Target: the contract between roles

What "general, correct and extensible" means here, as five rules every later item is measured against.

1. **The envelope stays as it is.** Typed signals over declared wires, with field lists and provenance. A new role declares its ports; a new topology declares its wires.
2. **A decision is data with a schema, enforced by the provider where it can.** Every role that decides (Plan, Check, Critique, Decide, Memory, and any later one) declares the shape of its decision once, as the Zod schema it validates with. The provider-neutral call takes that shape as one option (`outputSchema`), and each provider maps it to its own structured output: `response_format` on Chat Completions (OpenAI-compatible servers and Gemini), `text.format` on the Responses API, `output_config.format` on Anthropic, `format` on Ollama. A server that refuses it is learned from its answer and asked in words, as today. Prose stays prose: Do's answer and a plan's text are not forced into a schema beyond the field that holds them.
3. **An unreadable decision is no decision.** A reply that does not validate, after one decision call with the schema, is recorded as the role's failure to decide, with what was received, and the run goes on by the definition's rule for a missing decision (as Check does today). It never becomes "ok", "refine" or an empty plan.
4. **Work travels by reference.** The workspace is the artifact; a role receives what the lab measured changed (the files and a bounded diff) beside what the producer claims, marked as each. This exists for Check and is the model for every wire that carries work.
5. **Only a measurement ends a run as passed.** What a model writes can stop a run or send it back; it cannot make it passed, and it cannot keep the measured check from running.

## Phase A. Make what exists honest (no design change)

Each item: what, where, why, and when it is done. Line numbers are of commit 337c820.

**A1. A check never prints what it expected.** `packages/core/src/tasks/checker.ts:160-171`: the `file` and `answer` kinds return `...; expected ${expected}`. Print only what was found and that it did not match (`answer.txt holds "41", which is not the expected answer`). The test `roles/verdict.test.ts:102-113` asserts the leak today and changes with it. Check `engine/consult.ts:68` (an advisor whose sight includes checks) and `docs/FORMAT.md`. Done when no check kind's output contains its expected value, by a test over every kind.

**A2. An unreadable reply is no decision.** `roles/refinement.ts:289-297,546-558` (an empty reply becomes "refine"; the substring fallback turns "do not converge" into converge), `roles/critic.ts:243-249,445-448` (empty becomes "ok"), `roles/planning.ts:222,412-445` (empty becomes an empty plan). Follow Check's pattern in `roles/evaluation.ts:248-262`: no decision is emitted, the step record says the reply could not be read, and the round goes on by the rule for a missing decision. Memory already keeps its summary on an empty reply. Done when a test per role shows an empty reply and a prose reply with no decision each produce no decision signal and a recorded note, and the topology's outcome says so.

**A3. Decide's limits follow the run's.** `roles/registry.ts:335` reads only `params.maxRounds`, so a run with `maxRounds: 8` still converges at 3 (`roles/refinement.ts:255`). `maxTokens: 512` at `refinement.ts:279` and 1024 in `critic.ts` also have to cover a reasoning model's thinking: raise them to the role's configured limit. Done when a test runs Deep Reasoning with a round limit of 5 and Decide does not converge by rule before it.

**A4. A wire switched off stays off.** `roles/recipes.ts:366-372` never passes `enabled`, and `engine/pipeline.ts:374` sets it true. Done when a definition with a disabled way back delivers nothing over it, by a test.

**A5. A model's stop does not skip the measured check.** `engine/topology-run.ts:802` skips the measured outcome for any stop, and `pipeline.ts:1671` gives a planner's `stop` and a critic's `abort` the same label as a person's stop. Give a role's stop its own reason (`stopped by Plan`), run the measured check anyway, and report both. Done when a test with a planner that says stop and a failing check ends failed, with the reason naming both.

**A6. A producer that crashed is not passed.** `engine/topology-run.ts:802-808`: with Do's provider throwing and a check that passes on the untouched workspace, the run reports passed. The measured check still decides the work, and the run's outcome must carry the crash: report `failed` when the producing role errored and changed nothing, or keep `passed` with the error in the reason; the first is the honest one for a benchmark. Done by a test of that case.

**A7. Roles after a passing Check do not spend.** `engine/pipeline.ts:862-876,917`: the pass is evaluated after the round finishes, so Memory made a model call after the final pass, which inflates an arm's tokens. Stop the round at the pass, or mark what ran after it. Done when the step records of a run that passes in round 1 hold no model call after Check's pass.

**A8. Provider edges.** One commit each, each with a fake-server test.
- `providers/openai.ts:287-331`: a stream that ends with no `finish_reason`, or is cut by the call's timeout, is returned as a complete answer with 0 tokens. Throw as the other three paths do.
- `providers/call-limits.ts:52-55`: `rethrowCallError` builds a new `ModelCallTimeoutError` and loses `noRetry`, so a timeout after streamed text falls back and the text shows twice (`brains.ts:176`). Carry the flag.
- `providers/refused-params.ts:44-47`: the `param` branch accepts any 400 that names the field, so `temperature: 2.5` teaches "this model refuses temperature" for the whole process. Require the refusal wording or an `unsupported_parameter` code there too, treat `unsupported_value` as a value error, and never drop `include: reasoning.encrypted_content` on a value error. Add a way to forget (a failed call with the learned form unlearns it).
- `utils/retry.ts:34` and `providers/brains.ts:59` read `status` and `statusCode`; Ollama's error carries `status_code`, so its 5xx is never retried and never falls back. Read all three.
- `providers/openai.ts:189-191`: a streamed `response.failed` is given status 400, so a server error is not retried and is fed to the refusal learner. Map the event's own code.
- `providers/openai.ts:228`: a 200 body without `choices` (OpenRouter documents an error object there) throws a TypeError. Raise the body's own error.
- `providers/anthropic.ts:113-126` with the pinned SDK 0.39.0: a non-streamed call with `maxTokens` above 21,333 is refused before any request. Stream such calls, or upgrade the SDK (phase D).
- `providers/entries.ts:224`: an Anthropic entry without its own `baseUrl` lets `ANTHROPIC_BASE_URL` from the environment redirect its key. Pass the kind's default base as the other kinds do.
- `providers/openai.ts:306`: streamed calls that all carry `index: 0` with different ids are merged into one. A new id on a used index starts a new call.
- `providers/entries.ts:261`: `testEntry` sends `maxTokens: 8`; the Responses API is believed to refuse an output limit under 16 (not verified). Send 16 or more.

**A9. Secrets never land in a record.** `engine/recorder.ts:85` redacts only `error`; recorded `messages` (:39), `note` (:74) and `route.fallbacks[].error` (:77) are not redacted. `providers/entries.ts:180` prints the first 12 characters of a raw key. `OPENAI_ORG_ID` and `OPENAI_PROJECT_ID` go as headers to every compatible host, and an `openai` kind entry with a custom `baseUrl` gets the environment's `OPENAI_API_KEY`. Done when one redaction pass covers every recorded string, the warning prints no part of a key, and the environment's OpenAI identity goes only to api.openai.com, each by a test.

## Phase B. Decisions as data: one option, every provider's own mechanism

The branch `wip/output-schema` (commit 149c2f5) holds the first piece, tested: `packages/core/src/utils/output-schema.ts`, `outputSchemaOf(name, zodSchema)`, which turns a role's Zod schema into a JSON Schema every strict mode accepts (each object closed, all properties required, no keyword outside the common subset), through the library `zod-to-json-schema`. Rebase it onto `main` to start.

**B1. The neutral option.** `ChatCompletionOptions.outputSchema?: { name: string; schema: Record<string, unknown> }` in `types/llm.ts`, documented as: the shape the reply must have; a provider that can hold the reply to it does, and the caller validates either way.

**B2. Each provider's mapping**, each behind the refusal learner (a new refusable field, `output_schema`, with the wire names it goes by: `response_format`, `text`, `output_config`, `format`), so a server that refuses it gets the call again without it and the role's words-only path.
- Chat Completions (`providers/openai.ts`): `response_format: { type: "json_schema", json_schema: { name, schema, strict: true } }`.
- Responses API (`providers/openai-responses.ts`): `text: { format: { type: "json_schema", name, schema, strict: true } }`.
- Anthropic (`providers/anthropic.ts`): `output_config: { format: { type: "json_schema", schema } }` (the shape of the documented request; objects need `additionalProperties: false`, which the helper sets). The pinned SDK does not type the field: pass it through, and see D4.
- Ollama (`providers/ollama.ts`): `format: schema`, only on a call that offers no tools, since a grammar over the reply would forbid a tool call written as text.
- Done when a fake-server test per provider shows the field on the wire, and a 400 that names it sends the call again without it.

**B3. The roles use it on their decision call.** Check's verdict call, Critique, Decide and Memory pass their existing schema. Plan gets a schema of its own (`strategy` as an enum, `reasoning`, `plan`, `nextTask`, `priority`) and Check's two-step pattern: it works with its tools, and when its reply does not validate, one decision call without tools and with the schema. Its prompt asks for the object as the others do (`jsonFormatInstruction`). The legacy label reader stays only as the recover path and learns to read decorated labels (`**STRATEGY**: stop`, `### 2) STRATEGY **pivot**`).
- Done when: the planner replies of the recorded runs, replayed through the new reader, lose no decision (the 25 lost ones are the fixture); a live run on Ollama of Plan & Execute and Deep Reasoning shows the decision arriving as validated JSON; and A2's rule holds for Plan.

**B4. Readable claims.** `roles/evaluation.ts:459-476` gives Check the producer's claim as a raw JSON blob with escaped newlines. Render the text as text and the counts beside it. Done by a snapshot of Check's prompt.

**B5. Record it.** The step record says whether a decision came constrained by the provider, asked in words, or from the recover path, so an experiment can tell them apart.

**Later, the author's call (decision 6):** decisions as tool calls instead of constrained text. Structured output is what the providers recommend when a call exists only to return JSON, and the two newest Claude models refuse a forced tool call, so this plan takes structured output first.

## Phase C. Each topology carries what its description says

Items C1 to C4 change no design; C5 to C8 need the author's decision first.

**C1. A contract test over every built-in definition.** For each topology: every wire's signal type is read by its target role's engine, every signal type a role's prompt needs has a wire or a run input, and every field a prompt reads is in the wire's `fields`. It fails today on: Supervised Coder's `w-plan-to-review` (Check never reads `task`), Deep Reasoning's `w-exec-refine` (Decide never reads `execution_result`), Adversarial Duel's `scoreboard` (Plan never emits `context`), and the unwired `stagnation_alert`, `intervention` and `tool_calls` to Critique. Each failure is then fixed by wiring it or removing it.

**C2. Full Agent Pipeline's way back.** Check's corrections go to Plan only, and Plan sees only "Verdict: fail", so round 2's Do has no corrections, no evidence and no previous answer. Carry Check's corrections and the failed checks to Do, as Execute & Evaluate does, and give Plan the evidence. Done when round 2's Do prompt in a test holds them.

**C3. Plan hands over the plan.** In Plan & Execute and Supervised Coder only Plan's `task` port is wired, so Do gets the next task and never the plan. Wire `plan` too. Done by a test of Do's prompt.

**C4. Reflexion reflects from round 1.** `roles/memory.ts:179` emits nothing below three buffered signals, so a round where Do used no tool leaves round 2 without a reflection, and the summary is built from 100-character previews (`memory.ts:298-307`) and never from Check's evidence. Emit from the first failed round, from Check's evidence and the failed checks. Done when a two-round test shows the reflection in Do's second prompt.

**C5. Unused settings.** Every role's `maxIterations`, `delayMs`, `concurrent` and `frequency` are unread in rounds, and Do's tool cap is always 20 because `registry.ts:100-107` passes no `maxToolRounds`. Read them or remove them from the format.

**C6. Decide (decision 1).** It sees a round number, a pass rate and "verdict: fail"; with one check the rate is 0 or 100, so choosing between "refine" and "start over" has no evidence behind it, and it writes corrections from nothing ("address the critic's feedback" when the critic said nothing), which land in Do's prompt. In the recorded runs it chose "start over" in 9 of 10 turns where it made a call.

**C7. Critique (decision 2).** In 117 recorded turns it made 3 model calls; its heuristics need two log entries and its model three, and Decide converges by rule at round 3.

**C8. Adversarial Duel (decision 3).** Its two sides run one after another in one workspace, the second reads the first's file, the arbiter sees both claims with no owner and only the last diff, the one `corrections` signal reaches both, and the run's answer is always the second's.

**C9. The Ralph Loop (decisions 4 and 5).** It reports passed from boxes Do ticks itself, and on a task with no plan file it does one turn and never hears the measured check.

## Phase D. The provider layer, general

**D1. Finish reasons, one meaning on every provider.** Add `refusal` and `error` to the neutral set; map Anthropic's `refusal` and `pause_turn` at the resume cap, Chat Completions' `content_filter` and `message.refusal`, and the Responses API's incomplete reasons. A truncated reply that holds a tool call is `length` on every provider and its call is not run (today OpenAI and Ollama run it with `{_raw}`). The empty-reply nudge does not fire on a refusal.

**D2. State a provider keeps is tagged by what can read it.** `providerItems` and `providerContent` carry no model or host, `echo` only a provider name. Tag each with provider, host and model, and send it back only where all three match. This also settles a brain's fallback mid-run: a turn another model wrote is rebuilt from its neutral form.

**D3. A conversation every server accepts.** Before sending: whitespace-only assistant text dropped (Anthropic refuses it), tool call ids valid for the target (Mistral wants nine alphanumerics; the fallback ids `call-0` repeat across turns and Anthropic refuses duplicates), parallel tool results in one user message for Anthropic (today one message per result, relying on the API merging them), and the pruning notice sent as a user-side note where a server takes no system message mid-conversation (`utils/context-window.ts:119-128`; Anthropic drops it silently today). One normalizing step per provider, with a test of each rule.

**D4. Anthropic's SDK.** Upgrade from 0.39.0 to the current major, following its changelog: it types thinking, structured outputs and the newer stop reasons, and removes the non-streaming limit of A8. Run the cloud-quirks tests before and after.

**D5. Tool calls written as text, on any server.** The text protocol lives in the Ollama provider. Models of the same families served elsewhere (NVIDIA's catalog, vLLM, llama.cpp) can lose a call the same way. Move the protocol behind an entry option (`toolCalls: "native" | "text" | "auto"`) the Chat Completions path can use, with `auto` deciding as Ollama's does where the server says its template, and otherwise from a first lost call.

**D6. Defaults that will not age.** Temperature 0.7 is sent by every provider unless the role sets one: send none unless set. `DEFAULT_MAX_TOKENS` of 4096 also has to hold a reasoning model's thinking: raise it and let an entry set it. `isOpenAIHost` knows only api.openai.com: let an entry set `api` (the type has it; `entriesOf` does not read it). `stream_options` goes to every server: learn its refusal. Retries multiply (the SDKs' 2 times `withRetry`'s 3): turn the SDKs' own retries off.

**D7. Usage that is always there.** A stream with no usage chunk records 0 tokens silently (`openai.ts:255-259`): mark the usage as unknown. Record reasoning and cached tokens where a provider reports them (phase E needs them).

**D8. A conformance suite.** One list of scenarios (a short reply, streaming, a two-step tool chain, parallel calls, a refused field, a cut stream, a timeout mid-stream, a 5xx, a wrong key, a refusal, a structured decision) run against every provider path through fake servers that answer as each API documents. A new provider is done when it passes the list. The probe scripts in `benchmark-results/2026-11-20/probes` are its first draft against real servers.

## Phase E. The benchmark's data, and cheaper models

**E1. Every number of a run as tables (the author, 2026-11-20).** "La salida de un test de benchmark debe ser tablas con toda la data incluido costos, tiempo, reintentos, todo, para luego poder hacer estadística y gráficos profesionales." `results.jsonl` holds per attempt its outcome, checks, tokens in and out, duration, rounds, fallbacks, failed calls, the model and jig-core's version. To add, from the step records: a row per role and per model call (tokens in, out, reasoning and cached; time; time to first token; tool calls by tool; the finish reason), every retry and its cause (a network retry, a refused field, a call asked again, an empty reply nudged, thinking left out), the cost (from the price a provider reports or a dated price table, saying which), and the machine. Export tidy CSV beside the JSON lines (`attempts.csv`, `roles.csv`, `calls.csv`), a summary per arm, and an HTML report with charts fit to publish: each arm's rate with its interval, tokens and cost against the rate, where the time goes by role.

**E2. NVIDIA's models.** As CONCEPT section 8 lists: the author's key, the probe over the catalog to learn which models call tools, a default chosen from the probe, pacing for the free tier (the benchmark at `concurrency: 1`, honouring a 429's retry-after), and D5 for the families that write calls as text.

**E3. What the comparison cannot say today.** An arm that goes round again hears the measured check, and the direct arm and the Ralph Loop do not. Add best-of-N at the same budget as a baseline (already in CONCEPT), and a variant of the direct arm that may answer again after a failed check, so "a harness helps" can be told from "a second try helps".

**E4. A harder public set.** HumanEval is saturated for current cheap cloud models (every arm passed all five on two of them).

## Phase F. Keep it from regressing

**F1. Recorded replies as fixtures.** A script that samples replies per role from step records into `packages/core/src/__fixtures__/replies/`, scrubbed of paths, with what a correct reading of each is. Every parser is tested against them. The planner's 25 lost decisions are the first set.

**F2. A prompt snapshot per role per topology,** for round 1 and round 2, so a change in what a role is told shows in review. The lab already pins sight matrices; this pins the words.

**F3. The lock sees prompts.** A change to a role's prompt without a version bump is invisible to jig-benchmark's lock (a known follow-up): hash the built-in prompts into the engine identity.

## Decisions for the author

Each with a recommendation; the plan does not go past these without an answer.

1. **What Decide sees.** It decides from counts only, by the thesis that a judge should not read the producer's words. Options: (a) keep counts and make Decide a rule, with no model call and no corrections of its own; (b) give it Check's evidence and the failed checks, both marked by provenance, so its choice has grounds; (c) remove it from topologies with a single measured check. Recommended: (a) now, since a model adds nothing to a rule over one number, and (b) as an experiment variant, since H2 is the hypothesis it tests.
2. **What Critique is for.** Options: (a) a role that reads the round's record every round, with a model; (b) what it is today, a heuristic that rarely speaks, named as such in the drawing; (c) removed from the built-ins until an experiment needs it. Recommended: (b), with its interventions wired so they can act (C1).
3. **Adversarial Duel.** Options: (a) each side in its own copy of the workspace, the arbiter shown both claims with their owners and both diffs, the winner's copy kept; (b) renamed to what it is, two producers in sequence. Recommended: (a); it needs workspace copies per role, which the measured checks already use.
4. **The Ralph Loop's "passed".** Passed from ticked boxes contradicts "only a measurement ends a run as passed". Recommended: with a measured check, the check decides; without one, the outcome is "done, not verified", never passed.
5. **Whether the Ralph Loop hears the check.** On a task with no plan file it does one turn. Letting it go round again on a failed check makes it Execute & Evaluate without a Check role, which changes what the baseline is. Recommended: keep the baseline as one loop, and add the retry variant of E3 beside it, so both are in every comparison.
6. **Decisions as tool calls.** After phase B, whether to move every decision to a tool call. Recommended: no, unless a provider's structured output proves unreliable in the conformance suite.
7. **OpenAI's reasoning effort.** `low` by default since 0.1.9, not confirmed by the author. Recommended: keep.
8. **When to publish 0.1.9.** It is ready and not published. Everything found here either predates it or is rare in it (the refusal learner's value errors). Recommended: publish it as it is, and ship phase A as 0.1.10.

## What this assessment did not verify

- No cloud API was called for it. Every rule of a real service above (Gemini's thought signature on a turn another provider wrote, Mistral's id format, the Responses API's minimum output limit, whether Gemini sends `index: 0`) is from documentation or memory and is marked where it appears.
- The legacy cycles scheduler's concurrent path, `sight.ts`, `play.ts`, replay, the memory gateway, permissions and `pruneMessages` beyond a read; the `chatStream` methods, used only by the web package; the text protocol's JSON repair in depth; the catalog's ranking.
- The reviewers' scratch tests are not in the repository: each item above is to be confirmed again by the test written with its fix.
- The counts from recorded runs come from six passes on four cloud models and five problems of each of two datasets, read by scripts in the session, not from a test in the repository.
