# AGENTS.md — core

## Routines

- A routine description is one sentence of at most 65 characters. It is shown in UI tooltips.
- When a routine exists both as a function and as a method, both forms behave identically and share the description.
- A routine with a call subject is registered once with `registerRoutine` and its arguments are built with `arg`, so the handler gets typed values without casts. `registerFunction` is only for routines without a subject, such as `if` or `pi`.
- Routine examples are user documentation and tests at the same time. Each form of a routine has at least one example, and examples use neutral, product-agnostic data.
- An example either returns a `result` or fails with an `error`: the error definition, its message and the offsets it points at in each form of the routine. A wrong call worth explaining to users is written as an error example, not only as a test case.
- An example of a routine that reads the records around its formula, such as `parent` or `previous`, gives those records in `records` and runs over them as a host runs it; its result is the list of the cells.
- New capabilities are added as optional trailing arguments. The meaning of an existing argument never changes.
- An argument that takes a pattern accepts both text and a regular expression. Flags travel inside the regex literal, never as a separate argument. Text is compiled as a regular expression, except in routines whose job is plain substring search.
- Text routines count and slice user-perceived characters (grapheme clusters), not UTF-16 code units.
- A routine whose result can differ for the same arguments, such as `now` or `today`, is registered with `volatile: true`. Otherwise an evaluator keeps a stale result when the reads of a formula do not change.

## Evaluator

- One failing formula never stops the others: it fails its own cell, and the cells that read it fail with `INPUT_ERROR`. A pass throws only for a misuse of the API by the host.
- After a pass, every formula cell holds the value it would have if all formulas were evaluated in dependency order.
- The limits of the evaluator, such as how deep cells nest before they wait on the explicit stack, are product guarantees. Changing a limit needs the owner's approval.
- The evaluator stays usable on a browser main thread. `evaluateAsync` honors timeouts and abort signals.
- Ordering and cancellation are tested under arbitrary timing, not only along the happy path.

## Values and errors

- Formula values are immutable. Routines and operators return new values and never mutate their inputs.
- JavaScript values become formula values through the single shared conversion path. Don't construct data types ad hoc in helpers.
- Errors are created through the `Errors` factories, never as plain `Error`. The location points at the offending argument or operand, not at the whole call.
