# Workout Tracker

A [webxdc](https://webxdc.org) app for planning workouts, logging every set, and tracking progress
over time. Runs in Delta Chat and other webxdc messengers, or in any browser by opening
`index.html`.

## Features

- **Plan**: build workout plans as days of exercises with sets, reps or seconds, and weight.
  Every edit keeps the earlier version.
- **Log**: run a plan as a cycle and log each session. Set fields accept formulas such as `16+2`
  or `3x5`. One workout timer keeps running while you train.
- **Workout**: an exercise library with levels, notes, video links, and your best and latest
  sets for each exercise.
- **Personal**: BMI, BMR, daily calorie and protein targets from your body data.
- **Analytics**: reps, weight and workout time over a date range, plus a calendar of sessions.
- **Archive** exercises, plans and cycles you no longer use; their history stays.

## Your data

Everything is stored on your device (`localStorage`). It is not synced between devices or
shared with chat members. Use Settings → **Make a backup** / **Restore a backup** to move data
as a `.json` file.

## Build

```sh
./build.sh
```

This writes `workout-tracker.xdc` with the app files only. To release, tag a version and attach
the `.xdc` file to the release.

## License

[MIT](LICENSE)
