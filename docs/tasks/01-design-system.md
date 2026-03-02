# Task 01 — Design System

## Goal

Implement the e-ink-friendly design tokens and base component styles from the requirements as Tailwind CSS v4 theme config and utility classes.

## Subtasks

- [ ] Define CSS custom properties / Tailwind theme for the color palette:
  - Text `#1a1a1a`, Secondary `#555555`, Border `#cccccc`, Background `#ffffff`
  - Active `#2e7d32`, Waiting `#f57f17`, Error `#c62828`, Link/Action `#1565c0`
- [ ] Set up system font stack (`system-ui, -apple-system, sans-serif`), min weight 400, body 16px min
- [ ] Establish base layout: mobile-first single column, sidebar + main at ≥768px
- [ ] Enforce design constraints via CSS:
  - No animations, transitions, or gradients
  - No colored background fills on cards/rows/sections — borders and whitespace only
  - 44×44px minimum tap targets
- [ ] Create syntax highlighting theme CSS for code blocks (keyword, string, comment, number, function, operator, type tokens)

## Acceptance

- Design tokens available as Tailwind utilities / CSS vars
- A test page demonstrating all color roles, typography, and layout breakpoints
- No animations/transitions anywhere in the CSS

## References

- Requirements: Design System (full section)
