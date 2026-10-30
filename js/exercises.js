// The exercises a user can pick from on the Build Workout page: a short list
// of popular lifts first, then the full open database (js/exerciseDatabase.js).
// Users can add their own on top of these (saved separately in storage).
// A popular lift's id is the database exercise whose photos, muscles and steps it uses.
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
  { name: "Bench Press", group: "Chest", muscle: "Chest", equipment: "Barbell", id: "Barbell_Bench_Press_-_Medium_Grip" },
  { name: "Incline Dumbbell Press", group: "Chest", muscle: "Chest", equipment: "Dumbbell", id: "Incline_Dumbbell_Press" },
  { name: "Chest Fly", group: "Chest", muscle: "Chest", equipment: "Cable", id: "Flat_Bench_Cable_Flyes" },
  { name: "Push-Up", group: "Chest", muscle: "Chest", equipment: "Bodyweight", id: "Pushups" },
  { name: "Deadlift", group: "Back", muscle: "Lower back", equipment: "Barbell", id: "Barbell_Deadlift" },
  { name: "Pull-Up", group: "Back", muscle: "Lats", equipment: "Bodyweight", id: "Pullups" },
  { name: "Barbell Row", group: "Back", muscle: "Middle back", equipment: "Barbell", id: "Bent_Over_Barbell_Row" },
  { name: "Lat Pulldown", group: "Back", muscle: "Lats", equipment: "Cable", id: "Wide-Grip_Lat_Pulldown" },
  { name: "Seated Cable Row", group: "Back", muscle: "Middle back", equipment: "Cable", id: "Seated_Cable_Rows" },
  { name: "Back Squat", group: "Legs", muscle: "Quadriceps", equipment: "Barbell", id: "Barbell_Full_Squat" },
  { name: "Front Squat", group: "Legs", muscle: "Quadriceps", equipment: "Barbell", id: "Front_Barbell_Squat" },
  { name: "Romanian Deadlift", group: "Legs", muscle: "Hamstrings", equipment: "Barbell", id: "Romanian_Deadlift" },
  { name: "Leg Press", group: "Legs", muscle: "Quadriceps", equipment: "Machine", id: "Leg_Press" },
  { name: "Walking Lunge", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell", id: "Dumbbell_Lunges" },
  { name: "Leg Curl", group: "Legs", muscle: "Hamstrings", equipment: "Machine", id: "Lying_Leg_Curls" },
  { name: "Calf Raise", group: "Legs", muscle: "Calves", equipment: "Machine", id: "Standing_Calf_Raises" },
  { name: "Seated Calf Raise", group: "Legs", muscle: "Calves", equipment: "Machine", id: "Seated_Calf_Raise" },
  { name: "Goblet Squat", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell", id: "Goblet_Squat" },
  { name: "Hack Squat", group: "Legs", muscle: "Quadriceps", equipment: "Machine", id: "Hack_Squat" },
  { name: "Bulgarian Split Squat", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell", id: "Split_Squat_with_Dumbbells" },
  { name: "Sumo Deadlift", group: "Legs", muscle: "Glutes", equipment: "Barbell", id: "Sumo_Deadlift" },
  { name: "Hip Thrust", group: "Legs", muscle: "Glutes", equipment: "Barbell", id: "Barbell_Hip_Thrust" },
  { name: "Glute Bridge", group: "Legs", muscle: "Glutes", equipment: "Bodyweight", id: "Butt_Lift_Bridge" },
  { name: "Leg Extension", group: "Legs", muscle: "Quadriceps", equipment: "Machine", id: "Leg_Extensions" },
  { name: "Reverse Lunge", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell", id: "Dumbbell_Rear_Lunge" },
  { name: "Step-Up", group: "Legs", muscle: "Quadriceps", equipment: "Dumbbell", id: "Dumbbell_Step_Ups" },
  { name: "Good Morning", group: "Legs", muscle: "Hamstrings", equipment: "Barbell", id: "Good_Morning" },
  { name: "Nordic Curl", group: "Legs", muscle: "Hamstrings", equipment: "Bodyweight", id: "Natural_Glute_Ham_Raise" },
  { name: "Hip Abduction", group: "Legs", muscle: "Abductors", equipment: "Machine", id: "Thigh_Abductor" },
  { name: "Hip Adduction", group: "Legs", muscle: "Adductors", equipment: "Machine", id: "Thigh_Adductor" },
  { name: "Box Jump", group: "Legs", muscle: "Quadriceps", equipment: "Bodyweight", id: "Front_Box_Jump" },
  { name: "Overhead Press", group: "Shoulders", muscle: "Shoulders", equipment: "Barbell", id: "Standing_Military_Press" },
  { name: "Dumbbell Shoulder Press", group: "Shoulders", muscle: "Shoulders", equipment: "Dumbbell", id: "Dumbbell_Shoulder_Press" },
  { name: "Lateral Raise", group: "Shoulders", muscle: "Shoulders", equipment: "Dumbbell", id: "Side_Lateral_Raise" },
  { name: "Face Pull", group: "Shoulders", muscle: "Shoulders", equipment: "Cable", id: "Face_Pull" },
  { name: "Barbell Curl", group: "Arms", muscle: "Biceps", equipment: "Barbell", id: "Barbell_Curl" },
  { name: "Hammer Curl", group: "Arms", muscle: "Biceps", equipment: "Dumbbell", id: "Hammer_Curls" },
  { name: "Tricep Pushdown", group: "Arms", muscle: "Triceps", equipment: "Cable", id: "Triceps_Pushdown" },
  { name: "Skull Crusher", group: "Arms", muscle: "Triceps", equipment: "EZ bar", id: "EZ-Bar_Skullcrusher" },
  { name: "Dip", group: "Arms", muscle: "Triceps", equipment: "Bodyweight", id: "Dips_-_Triceps_Version" },
  { name: "Plank", group: "Core", muscle: "Abdominals", equipment: "Bodyweight", id: "Plank" },
  { name: "Hanging Leg Raise", group: "Core", muscle: "Abdominals", equipment: "Bodyweight", id: "Hanging_Leg_Raise" },
  { name: "Cable Crunch", group: "Core", muscle: "Abdominals", equipment: "Cable", id: "Cable_Crunch" },
  { name: "Russian Twist", group: "Core", muscle: "Abdominals", equipment: "Bodyweight", id: "Russian_Twist" },
];

// Popular lifts first, then the database without any names already listed.
const EXERCISE_LIBRARY = (() => {
  const popularNames = new Set(POPULAR_EXERCISES.map((exercise) => exercise.name.toLowerCase()));
  const databaseOnly = EXERCISE_DATABASE.filter((exercise) => !popularNames.has(exercise.name.toLowerCase()));
  return [...POPULAR_EXERCISES, ...databaseOnly];
})();
