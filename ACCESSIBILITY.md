# Accessibility

The target is WCAG 2.2 level AA, in English and Hindi, on a phone and a desktop.

## What is checked automatically

- **axe-core in the component tests** on the brief form (empty, with errors, in
  Hindi), every workspace panel, the refine chat and the photo flow, the shared
  plan prompt and the policy pages (`tests/components`, `tests/app`).
- **axe-core with colour contrast in a real browser** on the form, every plan
  tab, the policy pages and the 404, in light and dark themes, on desktop and a
  360 px phone, plus the Hindi form and budget (`e2e/accessibility.spec.ts`).
- **A keyboard-only run** from the skip link through choosing an example,
  submitting and moving between tabs with the arrow keys.
- **Reduced motion.** With `prefers-reduced-motion: reduce` the loading pulse
  stops.
- **No sideways scroll** on every tab at 360 px.
- **Lint**: `eslint-plugin-jsx-a11y-x` in strict mode on every component.

## How it is built

- Real elements throughout. Buttons are `<button>`, the plan sections are WAI-ARIA tabs
  with roving focus, the share dialog is a native `<dialog>` that traps focus
  and closes on Escape, vendor cards are `<details>`.
- Every control has a visible label. Hints and errors are tied to their field
  with `aria-describedby`, and an invalid field gets `aria-invalid`. A failed
  submit shows an error summary that takes focus and links to each field, and
  everything typed is kept.
- Focus follows every view change. Creating, opening, editing or cancelling
  lands on the new page's heading; deleting a plan, a task or a guest lands on
  its Undo; undoing returns to the plan or the open panel; a failed form lands
  on the first field to fix.
- One polite live region exists from the first paint and carries every
  status message: ideas ready, a task or guest added, a change applied, a
  reply with no changes. Errors use `role="alert"` where they appear. Nothing
  is said only by a toast or only by colour; overdue tasks and overspends
  carry words as well as red.
- A control that becomes unavailable while focused, such as Save becoming
  Saved, keeps focus and uses `aria-disabled` rather than `disabled`.
- Icon-only controls don't exist. Links that open a new tab say so to screen
  readers.
- Colours meet 4.5:1 for text in both themes. Focus is a 3 px outline that
  stays visible in both.
- `<html lang>` follows the chosen language, and Hindi text gets a taller line
  height for its matras.
- Inputs use `inputmode="numeric"` for amounts and counts and
  `autocomplete="address-level2"` for the city.

## Known gaps

- No manual screen reader pass is recorded yet. The evidence so far is the
  automated checks above and the semantic structure they verify.
- The photo feature has no text alternative for the photo itself beyond "the
  photo you chose"; the ideas it returns are text.
