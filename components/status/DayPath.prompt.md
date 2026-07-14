The signature Masar component — a child's day as a dot path. Use it on the parent home screen, the child dashboard header, and bus timelines.

```jsx
<DayPath steps={[
  { label: 'At Home', state: 'done', time: '7:10' },
  { label: 'In Bus',  state: 'done', time: '7:45' },
  { label: 'Classroom', state: 'live', time: '8:02' },
  { label: 'Nap Time', state: 'pending' },
  { label: 'Home', state: 'pending' },
]} />
```

- `orientation`: horizontal (default) or vertical (bus trip timeline).
- The live step pulses amber with a halo. Done segments are teal at 40% opacity.
