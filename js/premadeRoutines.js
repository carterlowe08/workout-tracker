// Ready-made programs shown on the Workouts page's "Premade" tab. Each day
// becomes a workout when started. Exercise names match the exercise list.
const PREMADE_PROGRAMS = [
  {
    name: "5×5 Strength",
    description:
      "A beginner barbell program. Alternate Workout A and B three days a week (for example Mon/Wed/Fri). " +
      "When you finish every set, add 5 lb next time (10 lb on deadlifts).",
    days: [
      {
        name: "5×5 Workout A",
        exercises: [
          { name: "Back Squat", sets: 5, reps: 5 },
          { name: "Bench Press", sets: 5, reps: 5 },
          { name: "Barbell Row", sets: 5, reps: 5 },
        ],
      },
      {
        name: "5×5 Workout B",
        exercises: [
          { name: "Back Squat", sets: 5, reps: 5 },
          { name: "Overhead Press", sets: 5, reps: 5 },
          { name: "Deadlift", sets: 1, reps: 5 },
        ],
      },
    ],
  },
  {
    name: "Push / Pull / Legs",
    description:
      "A muscle-building split: chest, shoulders and triceps; back and biceps; then legs. " +
      "Run it once a week (3 days) or twice (6 days).",
    days: [
      {
        name: "Push Day",
        exercises: [
          { name: "Bench Press", sets: 4, reps: 8 },
          { name: "Overhead Press", sets: 3, reps: 8 },
          { name: "Incline Dumbbell Press", sets: 3, reps: 10 },
          { name: "Lateral Raise", sets: 3, reps: 12 },
          { name: "Tricep Pushdown", sets: 3, reps: 12 },
        ],
      },
      {
        name: "Pull Day",
        exercises: [
          { name: "Deadlift", sets: 3, reps: 5 },
          { name: "Pull-Up", sets: 3, reps: 8 },
          { name: "Barbell Row", sets: 3, reps: 8 },
          { name: "Face Pull", sets: 3, reps: 15 },
          { name: "Barbell Curl", sets: 3, reps: 10 },
        ],
      },
      {
        name: "Leg Day",
        exercises: [
          { name: "Back Squat", sets: 4, reps: 8 },
          { name: "Romanian Deadlift", sets: 3, reps: 10 },
          { name: "Leg Press", sets: 3, reps: 12 },
          { name: "Leg Curl", sets: 3, reps: 12 },
          { name: "Calf Raise", sets: 4, reps: 15 },
        ],
      },
    ],
  },
];
