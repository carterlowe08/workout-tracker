// The exercises a user can pick from on the Build Workout page: a short list
// of popular lifts first, then the full open database (js/exerciseDatabase.js).
// Users can add their own on top of these (saved separately in storage).
const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Shoulders", "Arms", "Core", "Cardio", "Other"];

const EQUIPMENT_TYPES = [
  "Barbell",
  "Dumbbell",
  "Cable",
  "Machine",
  "Bodyweight",
  "Kettlebell",
  "EZ bar",
  "Bands",
  "Medicine ball",
  "Exercise ball",
  "Other",
];

const POPULAR_EXERCISES = [
  { name: "Bench Press", group: "Chest", muscle: "Chest", equipment: "Barbell" },
  { name: "Incline Dumbbell Press", group: "Chest", muscle: "Chest", equipment: "Dumbbell" },
  { name: "Chest Fly", group: "Chest", muscle: "Chest", equipment: "Cable" },
  { name: "Push-Up", group: "Chest", muscle: "Chest", equipment: "Bodyweight" },
  { name: "Deadlift", group: "Back", muscle: "Lower back", equipment: "Barbell" },
  { name: "Pull-Up", group: "Back", muscle: "Lats", equipment: "Bodyweight" },
  { name: "Barbell Row", group: "Back", muscle: "Middle back", equipment: "Barbell" },
  { name: "Lat Pulldown", group: "Back", muscle: "Lats", equipment: "Cable" },
  { name: "Seated Cable Row", group: "Back", muscle: "Middle back", equipment: "Cable" },
  { name: "Back Squat", group: "Legs", muscle: "Quadriceps", equipment: "Barbell" },
  { name: "Front Squat", group: "Legs", muscle: "Quadriceps", equipment: "Barbell" },
  { name: "Romanian Deadlift", group: "Legs", muscle: "Hamstrings", equipment: "Barbell" },
  { name: "Leg Press", group: "Legs", muscle: "Quadriceps", equipment: "Machine" },
  { name: "Walking Lunge", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell" },
  { name: "Leg Curl", group: "Legs", muscle: "Hamstrings", equipment: "Machine" },
  { name: "Calf Raise", group: "Legs", muscle: "Calves", equipment: "Machine" },
  { name: "Seated Calf Raise", group: "Legs", muscle: "Calves", equipment: "Machine" },
  { name: "Goblet Squat", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell" },
  { name: "Hack Squat", group: "Legs", muscle: "Quadriceps", equipment: "Machine" },
  { name: "Bulgarian Split Squat", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell" },
  { name: "Sumo Deadlift", group: "Legs", muscle: "Glutes", equipment: "Barbell" },
  { name: "Hip Thrust", group: "Legs", muscle: "Glutes", equipment: "Barbell" },
  { name: "Glute Bridge", group: "Legs", muscle: "Glutes", equipment: "Bodyweight" },
  { name: "Leg Extension", group: "Legs", muscle: "Quadriceps", equipment: "Machine" },
  { name: "Reverse Lunge", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell" },
  { name: "Step-Up", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell" },
  { name: "Good Morning", group: "Legs", muscle: "Hamstrings", equipment: "Barbell" },
  { name: "Nordic Curl", group: "Legs", muscle: "Hamstrings", equipment: "Bodyweight" },
  { name: "Hip Abduction", group: "Legs", muscle: "Abductors", equipment: "Machine" },
  { name: "Hip Adduction", group: "Legs", muscle: "Adductors", equipment: "Machine" },
  { name: "Box Jump", group: "Legs", muscle: "Quadriceps", equipment: "Bodyweight" },
  { name: "Overhead Press", group: "Shoulders", muscle: "Shoulders", equipment: "Barbell" },
  { name: "Dumbbell Shoulder Press", group: "Shoulders", muscle: "Shoulders", equipment: "Dumbbell" },
  { name: "Lateral Raise", group: "Shoulders", muscle: "Shoulders", equipment: "Dumbbell" },
  { name: "Face Pull", group: "Shoulders", muscle: "Shoulders", equipment: "Cable" },
  { name: "Barbell Curl", group: "Arms", muscle: "Biceps", equipment: "Barbell" },
  { name: "Hammer Curl", group: "Arms", muscle: "Biceps", equipment: "Dumbbell" },
  { name: "Tricep Pushdown", group: "Arms", muscle: "Triceps", equipment: "Cable" },
  { name: "Skull Crusher", group: "Arms", muscle: "Triceps", equipment: "EZ bar" },
  { name: "Dip", group: "Arms", muscle: "Triceps", equipment: "Bodyweight" },
  { name: "Plank", group: "Core", muscle: "Abdominals", equipment: "Bodyweight" },
  { name: "Hanging Leg Raise", group: "Core", muscle: "Abdominals", equipment: "Bodyweight" },
  { name: "Cable Crunch", group: "Core", muscle: "Abdominals", equipment: "Cable" },
  { name: "Russian Twist", group: "Core", muscle: "Abdominals", equipment: "Bodyweight" },
];

// Popular lifts first, then the database without any names already listed.
const EXERCISE_LIBRARY = (() => {
  const popularNames = new Set(POPULAR_EXERCISES.map((exercise) => exercise.name.toLowerCase()));
  const databaseOnly = EXERCISE_DATABASE.filter((exercise) => !popularNames.has(exercise.name.toLowerCase()));
  return [...POPULAR_EXERCISES, ...databaseOnly];
})();
