
// Basic word & sentence bank for primary students
// Levels roughly: P1-3 (A1) and P4-6 (A1+~A2)
const WORD_BANK = {
  "P1-3": {
    "sightWords": ["I","you","we","he","she","it","my","your","a","an","the","is","am","are","in","on","at","to","go","like","see","can","do","have","and"],
    "phonicsCVC": ["cat","dog","sun","pen","bag","cup","bed","pig","fox","hat","jam","web","rug","bus","ten"],
    "animals": ["cat","dog","bird","fish","cow","duck","ant","bee","frog","lion","hen","goat"],
    "colors": ["red","blue","green","yellow","black","white","pink","purple","brown","orange"],
    "verbs": ["run","jump","walk","eat","sleep","read","write","sing","play","draw"],
    "sentences": [
      "I can run.",
      "You can jump.",
      "We like cats.",
      "She has a red bag.",
      "The dog is big.",
      "It is a blue pen.",
      "I see a bird.",
      "We are in the room.",
      "He can read and write."
    ]
  },
  "P4-6": {
    "topics": ["school","family","hobby","food","weather","daily routines"],
    "vocab": ["classroom","teacher","student","notebook","pencil","library","breakfast","lunch","dinner","soccer","music","drawing","rainy","sunny","cloudy","windy","always","usually","sometimes","never"],
    "sentences": [
      "I usually eat breakfast at seven o'clock.",
      "My sister sometimes plays soccer after school.",
      "It is windy and cloudy today.",
      "We have English on Monday and Wednesday.",
      "I like drawing and listening to music.",
      "He never watches TV before homework.",
      "Our classroom is next to the library."
    ],
    "questionPatterns": [
      {"q":"What time do you wake up?", "a":"I wake up at six o'clock."},
      {"q":"How often do you read books?", "a":"I usually read books on the weekend."},
      {"q":"What is your favorite subject?", "a":"My favorite subject is English."},
      {"q":"Where is the library?", "a":"It is next to the office."}
    ]
  }
};

// Simple reading passages
const PASSAGES = {
  "P1-3": [
    "This is my cat. Its name is Mimi. It can run and jump. I love my cat.",
    "I have a red bag. In my bag, I have a pen, a book, and a cup."
  ],
  "P4-6": [
    "Every weekday, I wake up at six o'clock. I have breakfast with my family. Then I go to school by bus. After school, I do my homework and play the guitar.",
    "The weather today is sunny but windy. We will play soccer in the evening. I will bring water and a cap."
  ]
};
