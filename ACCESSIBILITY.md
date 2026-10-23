# Accessibility

The target is WCAG 2.2 level AA, in English and Hindi, on a phone and a desktop.

## What is checked automatically

- **axe-core in the component tests** on the brief form (empty, with errors, in
  Hindi), every workspace panel, the refine chat and the photo flow, the shared
  plan prompt and the policy pages (`tests/components`, `tests/app`). Every axe
  run uses the WCAG 2.2 AA, best-practice and experimental rules.
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
  with roving focus and a panel that is a Tab stop, the share dialog is a
  native `<dialog>` that makes the page behind it inert, closes on Escape,
  reads its privacy note as its description and moves focus to Copy once the
  link is ready, and vendor cards are `<details>`.
- Every control has a visible label. In tables the column header is that
  label and the accessible name adds the row, such as "Reply from Mamaji's
  family"; a task's check box is labelled by the task's own title, which is
  also the click target. Hints and errors are tied to their field
  with `aria-describedby`, and an invalid field gets `aria-invalid`. A failed
  submit shows an error summary that takes focus and links to each field, and
  everything typed is kept.
- Focus follows every view change. Creating, opening, editing or cancelling
  lands on the new page's heading; deleting a plan, a task or a guest lands on
  its Undo; undoing returns to the plan or the open panel; a failed brief
  form lands on its error summary, which links to each field, and the
  add-task and add-guest forms land on the field to fix. When the focused button goes away because its job
  is done, focus moves to a stable place instead of the page: Reset to More,
  "Show removed tasks" and "Use N as the guest count" to the open panel, and
  closing a notice to the page heading.
- One polite live region exists from the first paint and carries the status
  messages: ideas ready, an answer that stopped early, a shared plan offered, a
  task or guest added, a change applied, a budget line moved, removed tasks
  back, the guest count used, a reply with no changes. The start of AI writing
  is not announced, so it never talks over the change that set it off. The
  guest count mismatch sits in a `role="status"` region that is always on the
  page, so it is read when it appears. Error notices use `role="alert"`; a field
  error is tied to its field, which takes focus once the error is drawn, so it
  is read with the label. Nothing is said only by a toast or only by colour;
  overdue tasks and overspends carry words as well as red.
- Ideas that are still streaming in have no Save button, so nothing focusable
  is swapped out under the cursor and a half-written idea can't be saved.
- A control that becomes unavailable while focused, such as Save becoming
  Saved, keeps focus and uses `aria-disabled` rather than `disabled`.
- Icon-only controls don't exist. Links that open a new tab say so to screen
  readers.
- Targets are at least 24 px: check boxes and radios are 24 px, and footer
  links are 30 px tall at 360 px wide. A task's title widens its check box's
  target to the whole line.
- The page reflows at 320 px and at 200% text with nothing scrolling sideways;
  the tab list wraps onto a second row instead of scrolling.
- Colours meet 4.5:1 for text in both themes. Focus is a 3 px outline that
  stays visible in both.
- `<html lang>` follows the chosen language, and Hindi text gets a taller line
  height for its matras. Text in the other language gets its own `lang`: AI
  ideas keep the language they were written in until they are made again, and
  plan titles can be typed in either, so the script decides (`lib/i18n/lang.ts`).
- The browser tab is named after the open plan.
- Inputs use `inputmode="numeric"` for amounts and counts and
  `autocomplete="address-level2"` for the city.

## Known gaps

- No manual screen reader pass is recorded yet. The evidence so far is the
  automated checks above and the semantic structure they verify.
- Until the AI has looked at it, the chosen photo's text alternative is only
  "the photo you chose"; after that it is the kind and mood the AI saw.
