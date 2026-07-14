Primary action button used across every Masar portal — teal primary, paper secondary, ghost, and danger.

```jsx
<Button variant="primary" size="md">Generate QR pickup</Button>
<Button variant="secondary" iconLeft={<Icon name="bus" />}>Track bus</Button>
<Button variant="ghost" size="sm">Cancel</Button>
```

- `variant`: `primary` (teal, default) · `secondary` (paper outline) · `ghost` · `danger`
- `size`: `sm` 34px · `md` 42px · `lg` 52px
- Hover dims to 94% brightness; press scales to 0.98. Use `fullWidth` for mobile CTAs.
