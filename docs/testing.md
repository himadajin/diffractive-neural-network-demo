# Testing Strategy

This project uses automated tests to reduce routine visual QA work, not to
replace visual judgment. The Artwork's visual design remains intentionally
adjustable, so tests should protect structural contracts rather than exact
visual parameters.

## Goals

- Catch broken interaction, input, camera, classifier, and rendering contracts
  before manual review.
- Keep design iteration cheap by avoiding brittle expectations around exact
  colors, blur radii, glow sizes, pixel positions, and camera numbers.
- Improve testability by moving important logic behind small, explicit
  boundaries before testing it.

## Principles

- Prefer testing mechanisms and relationships over precise numeric snapshots.
- Test important project specifications even when they include numbers. For
  example, the 28-by-28 Fixed Cell Field Resolution is part of the Artwork's
  language and should change together with its tests if the specification
  changes.
- Treat hard-to-test logic as a design smell: first look for an unclear boundary
  between pure logic and Canvas, Three.js, React, browser APIs, or ONNX runtime
  side effects.
- Split refactoring and test additions into separate commits when practical, so
  behavior-preserving extraction and newly defined expectations remain easy to
  review.
- Avoid adding tests directly around tangled implementation details just because
  coverage is possible.

## Vitest Scope

Vitest should focus on domain-adjacent logic with stable inputs and outputs.

- Input contracts: canonical input orientation, classifier normalization,
  input sampling, and 28-by-28 light sample generation.
- Response contracts: confidence smoothing and target-following behavior.
- Optical field contracts: fixed cell-field resolution and candidate-routing
  behavior, after field generation is separated from Canvas drawing.
- Camera contracts: responsive framing invariants and camera movement
  relationships, without locking exact presentation numbers.

React, WebGL, browser gesture wiring, and ONNX runtime behavior should not be
forced into unit tests when Playwright or a better logic boundary would be a
cleaner fit.

## Playwright Scope

Playwright should begin as interaction smoke testing and visual health checking.

- Verify the app starts, creates the WebGL canvas, and reports no page errors,
  console errors, or missing critical assets.
- Check idle state without requiring exact pixels.
- Draw through the Drawing Panel and verify that the app responds.
- Verify the clear control appears after drawing and disappears after clearing.
- Check that key viewer-facing controls remain reachable across representative
  desktop, tablet, and mobile viewports.
- Check Development Controls only as debug-mode integration behavior.

Avoid full screenshot equality and exact pixel-diff expectations until there is
a very specific, stable visual contract worth protecting.

## Adoption Order

Add tests in small, reviewable commits.

1. Add Vitest infrastructure and tests for already exported logic:
   responsive-camera invariants, digit-anchor invariants, confidence smoothing,
   and 28-by-28 light sample generation.
2. Separate classifier normalization from Canvas and ONNX runtime side effects,
   then test canonical input orientation, empty-input handling, and 28-by-28
   output shape.
3. Separate optical field generation from Canvas drawing, then test field
   resolution, peak normalization, and candidate-routing behavior.
4. Separate camera and debug gesture calculations from React event wiring, then
   test movement relationships and debug interaction priority.
5. Add Playwright smoke tests and visual health checks after the core logic
   boundaries are clearer.

Keep this document as the working strategy. Consider an ADR later, after several
tests have been added and the long-term principles have proven stable in
practice.
