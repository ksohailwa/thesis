// Static word lists for each CEFR level
// Vocabulary words with meanings and example sentences

export type WordItem = {
  word: string;
  level: string;
  meaning: string;
  sentence1: string;
  sentence2: string;
  corpus: string;
};

const medicalAdvancedWords = [
  {
    word: 'pneumonia',
    level: 'C2',
    meaning: 'lung infection causing inflammation of air sacs',
    sentence1: 'The patient developed severe pneumonia after the viral infection.',
    sentence2: 'Atypical pneumonia requires different antibiotic treatment approaches.',
    corpus: 'Bacterial pneumonia remains a leading cause of hospitalization in elderly populations.',
  },
  {
    word: 'auscultation',
    level: 'C2',
    meaning: 'process of listening to internal body sounds with stethoscope',
    sentence1: 'During auscultation, the cardiologist detected an irregular heartbeat.',
    sentence2: 'Thoracic auscultation revealed abnormal breath sounds in the left lower lobe.',
    corpus: 'Clinical auscultation of heart murmurs requires trained auditory discrimination.',
  },
  {
    word: 'hemorrhage',
    level: 'C2',
    meaning: 'heavy or uncontrolled bleeding from blood vessels',
    sentence1: 'The internal hemorrhage required emergency surgical intervention.',
    sentence2: 'Massive hemorrhage from the gastric ulcer necessitated transfusion.',
    corpus: 'Postoperative hemorrhage is a serious complication requiring immediate intervention.',
  },
  {
    word: 'diarrhea',
    level: 'C2',
    meaning: 'frequent passage of loose, watery stools',
    sentence1: 'The patient reported acute diarrhea beginning 48 hours post-procedure.',
    sentence2: 'Chronic diarrhea may indicate malabsorption syndrome or inflammatory bowel disease.',
    corpus: 'Infectious diarrhea outbreaks require epidemiological investigation and public health reporting.',
  },
  {
    word: 'pharyngitis',
    level: 'C2',
    meaning: 'inflammation of the pharynx; acute sore throat condition',
    sentence1: 'Her recurrent pharyngitis necessitated referral to an otolaryngologist.',
    sentence2: 'Streptococcal pharyngitis demands prompt antibiotic treatment to prevent sequelae.',
    corpus: 'Acute pharyngitis is clinically indistinguishable from viral pharyngitis without laboratory confirmation.',
  },
  {
    word: 'prosthesis',
    level: 'C2',
    meaning: 'artificial body part or limb replacement',
    sentence1: "The patient's advanced prosthesis allowed full functional restoration.",
    sentence2: 'Prosthesis fitting requires precise biomechanical alignment and patient rehabilitation.',
    corpus: 'Modern prosthesis technology utilizing myoelectric sensors represents significant advancement in patient mobility.',
  },
  {
    word: 'osteoporosis',
    level: 'C2',
    meaning: 'condition characterized by decreased bone mineral density',
    sentence1: 'Postmenopausal women face elevated risk for osteoporosis development.',
    sentence2: 'Screening for osteoporosis should begin at age 50 for women and 70 for men.',
    corpus: 'Osteoporosis prevention requires adequate calcium intake, vitamin D synthesis, and weight-bearing exercise.',
  },
  {
    word: 'arrhythmia',
    level: 'C2',
    meaning: 'abnormal heart rhythm or irregularity in heartbeat',
    sentence1: 'The ECG revealed paroxysmal atrial arrhythmia requiring medication management.',
    sentence2: 'Ventricular arrhythmia in acute myocardial infarction carries significant mortality risk.',
    corpus: 'Life-threatening arrhythmia necessitated emergency defibrillation and hemodynamic stabilization.',
  },
  {
    word: 'hemorrhoid',
    level: 'C2',
    meaning: 'inflamed vein in the anal area causing discomfort',
    sentence1: 'External hemorrhoids often cause itching and minor bleeding during defecation.',
    sentence2: 'Thrombosed internal hemorrhoids require prompt intervention due to severe pain.',
    corpus: 'Chronic hemorrhoid management involves dietary fiber increase and surgical intervention when conservative measures fail.',
  },
  {
    word: 'diaphragm',
    level: 'C2',
    meaning: 'muscular partition separating thoracic and abdominal cavities',
    sentence1: "The diaphragm's contraction initiates the inspiratory phase of respiration.",
    sentence2: 'Diaphragmatic paralysis results from phrenic nerve injury or compression.',
    corpus: 'Assessment of diaphragmatic excursion via fluoroscopy determines respiratory muscle function.',
  },
  {
    word: 'catheter',
    level: 'C2',
    meaning: 'thin tube inserted into body cavity for medical purposes',
    sentence1: 'Central venous catheter placement required sterile technique and fluoroscopic guidance.',
    sentence2: 'Urinary catheter-associated infections represent major source of nosocomial morbidity.',
    corpus: 'Long-term indwelling catheter management necessitates regular maintenance and infection prevention protocols.',
  },
  {
    word: 'cirrhosis',
    level: 'C2',
    meaning: 'progressive liver disease causing fibrosis and organ dysfunction',
    sentence1: 'Advanced cirrhosis resulted in hepatic encephalopathy and variceal bleeding.',
    sentence2: 'Alcoholic cirrhosis remains the leading cause of liver transplantation in Western nations.',
    corpus: 'Primary biliary cirrhosis is an autoimmune disorder affecting intrahepatic bile duct destruction.',
  },
  {
    word: 'epilepsy',
    level: 'C2',
    meaning: 'chronic neurological disorder characterized by recurrent seizures',
    sentence1: "The patient's epilepsy required long-term antiepileptic drug management.",
    sentence2: 'Temporal lobe epilepsy often responds poorly to conventional pharmacological intervention.',
    corpus: 'Sudden unexpected nocturnal death in epilepsy (SUDEP) remains a significant mortality risk requiring family counseling.',
  },
  {
    word: 'dysentery',
    level: 'C2',
    meaning: 'infectious disease causing severe diarrhea and intestinal inflammation',
    sentence1: 'Acute dysentery outbreak required isolation protocols and antimicrobial intervention.',
    sentence2: 'Dysentery epidemiology in developing regions correlates with inadequate sanitation infrastructure.',
    corpus: 'Bacterial dysentery transmission through contaminated water supplies necessitates public health intervention.',
  },
  {
    word: 'ischemia',
    level: 'C2',
    meaning: 'inadequate blood supply to an organ or tissue',
    sentence1: 'Acute myocardial ischemia manifested as chest pain radiating to left arm.',
    sentence2: 'Cerebral ischemia resulting from thrombotic stroke requires thrombolytic intervention.',
    corpus: 'Chronic peripheral ischemia may necessitate revascularization to prevent tissue necrosis and amputation.',
  },
  {
    word: 'syncope',
    level: 'C2',
    meaning: 'brief loss of consciousness; fainting episode',
    sentence1: 'Vasovagal syncope occurred during the phlebotomy procedure.',
    sentence2: 'Cardiac syncope carries greater morbidity risk compared to vasovagal etiology.',
    corpus: 'Recurrent syncope necessitates comprehensive cardiac evaluation including echocardiography and Holter monitoring.',
  },
  {
    word: 'uremia',
    level: 'C2',
    meaning: 'toxic condition resulting from elevated urea and other waste products',
    sentence1: 'Advanced renal failure culminated in symptomatic uremia requiring hemodialysis.',
    sentence2: 'Uremic encephalopathy resolved after initiation of renal replacement therapy.',
    corpus: 'Chronic uremia management involves careful monitoring of electrolytes and fluid balance.',
  },
  {
    word: 'pruritus',
    level: 'C2',
    meaning: 'severe or chronic itching sensation of the skin',
    sentence1: 'Intractable pruritus accompanied the patient\'s hepatic cirrhosis diagnosis.',
    sentence2: 'Uremic pruritus frequently accompanies end-stage renal disease management.',
    corpus: 'Atopic dermatitis-associated pruritus significantly impacts quality of life and psychological well-being.',
  },
  {
    word: 'dysphagia',
    level: 'C2',
    meaning: 'difficulty swallowing food or liquids',
    sentence1: 'Post-stroke dysphagia necessitated modified diet and speech-language pathology intervention.',
    sentence2: 'Oropharyngeal dysphagia increases aspiration risk and pneumonia susceptibility.',
    corpus: 'Neurogenic dysphagia resulting from amyotrophic lateral sclerosis requires swallowing rehabilitation.',
  },
  {
    word: 'gangrene',
    level: 'C2',
    meaning: 'tissue death resulting from loss of blood supply or infection',
    sentence1: 'Untreated diabetic foot ulceration progressed to wet gangrene requiring amputation.',
    sentence2: 'Gas gangrene caused by Clostridium perfringens represents a surgical emergency.',
    corpus: 'Prevention of gangrene through aggressive vascular intervention and infection control remains paramount.',
  },
  {
    word: 'metastasis',
    level: 'C2',
    meaning: 'spread of cancer cells to distant organs or tissues',
    sentence1: 'Lymph node metastasis indicated advanced disease requiring chemotherapeutic intervention.',
    sentence2: 'Pulmonary metastasis often indicates systemic progression and poor prognosis.',
    corpus: 'Early detection of metastasis significantly impacts survival outcomes and treatment planning.',
  },
  {
    word: 'myocardial',
    level: 'C2',
    meaning: 'relating to the muscular tissue of the heart',
    sentence1: 'Acute myocardial infarction presents with characteristic chest pain and ST elevation.',
    sentence2: 'Myocardial stunning following reperfusion may result in transient systolic dysfunction.',
    corpus: 'Myocardial ischemia detection via stress testing guides therapeutic intervention strategies.',
  },
  {
    word: 'thoracic',
    level: 'C2',
    meaning: 'relating to the chest or thorax region',
    sentence1: 'Thoracic aortic aneurysm requires emergency surgical intervention due to rupture risk.',
    sentence2: 'Thoracic imaging via computed tomography provides detailed pulmonary parenchymal assessment.',
    corpus: 'Thoracic outlet syndrome causes upper extremity symptoms through neurovascular compression.',
  },
  {
    word: 'fibrillation',
    level: 'C2',
    meaning: 'rapid, uncontrolled contractions of cardiac muscle fibers',
    sentence1: 'Atrial fibrillation increases stroke risk through thromboembolic phenomenon.',
    sentence2: 'Ventricular fibrillation requires immediate defibrillation to restore organized cardiac rhythm.',
    corpus: 'Anticoagulation management in fibrillation patients reduces cardioembolic stroke incidence.',
  },
] satisfies WordItem[];

export const wordsByLevel: Record<string, WordItem[]> = {
  A1: [
    { word: 'family', level: 'A1', meaning: 'a group of people who are related to each other, such as parents and children', sentence1: 'I live with my family in a small house.', sentence2: 'She comes from a large family with five siblings.', corpus: 'Family is the most important thing in life.' },
    { word: 'waitress', level: 'A1', meaning: 'a woman whose job is to serve customers in a restaurant', sentence1: "She's working as a waitress at the moment.", sentence2: 'I will ask the waitress for the bill.', corpus: 'The owners are looking to hire a waitress.' },
    { word: 'sandwich', level: 'A1', meaning: 'two slices of bread with meat', sentence1: 'I love a toasted sandwich', sentence2: 'We ate turkey sandwiches', corpus: 'I made him some sandwiches to take with him' },
    { word: 'nationality', level: 'A1', meaning: 'the legal status of belonging to a particular nation', sentence1: 'She has British nationality.', sentence2: 'The college attracts students of all nationalities.', corpus: 'He has held French nationality for the past 20 years.' },
    { word: 'famous', level: 'A1', meaning: 'known and recognized by many people', sentence1: 'It is the most famous place in Edinburgh.', sentence2: 'This was the book that made her famous.', corpus: 'Tiger Woods is one of the most famous names in golf.' },
    { word: 'expensive', level: 'A1', meaning: 'costing a lot of money', sentence1: 'He buys very expensive clothes.', sentence2: 'The lights were expensive to install.', corpus: 'Making the wrong decision could prove expensive.' },
    { word: 'restaurant', level: 'A1', meaning: 'a place where you can buy and eat a meal', sentence1: 'We had lunch at a restaurant near the station.', sentence2: 'We had a meal in a restaurant.', corpus: 'We went to my favourite restaurant to celebrate.' },
    { word: 'museum', level: 'A1', meaning: 'a building where you can look at important objects', sentence1: 'They visited museums throughout the city', sentence2: 'We sometimes go to a museum', corpus: 'This exhibit is on loan from another museum.' },
    { word: 'interesting', level: 'A1', meaning: 'Someone or something that attracts your attention', sentence1: 'I like reading interesting books in the Library.', sentence2: 'The speaker made some interesting points.', corpus: 'She puts enough detail into the story to make it interesting.' },
    { word: 'weekend', level: 'A1', meaning: 'Saturday and Sunday', sentence1: 'At the weekends she goes to visit her parents.', sentence2: 'We spent the weekend at the beach.', corpus: 'The office is closed on weekends.' },
    { word: 'exciting', level: 'A1', meaning: 'making you feel very happy', sentence1: 'This is an exciting opportunity for me.', sentence2: 'I still find the job exciting.', corpus: "That's what makes the game so exciting for the fans." },
  ],

  A2: [
    { word: 'colleague', level: 'A2', meaning: 'someone that you work with', sentence1: "We're entertaining some colleagues of Ben's tonight.", sentence2: 'We were friends and colleagues for more than 20 years.', corpus: 'The network has enabled practitioners to gain research experience by working with more experienced colleagues.' },
    { word: 'envelope', level: 'A2', meaning: 'a flat paper container for a letter', sentence1: 'Last night I left an envelope in your house.', sentence2: 'Writing paper and envelopes are provided in your room.', corpus: "Don't forget to put a stamp on the envelope." },
    { word: 'fantastic', level: 'A2', meaning: 'extremely good', sentence1: 'You look fantastic in that dress.', sentence2: 'This was a fantastic opportunity for students', corpus: 'She must be earning a fantastic amount of money.' },
    { word: 'lemonade', level: 'A2', meaning: 'a cold drink with a lemon flavour', sentence1: 'We drank lemonade.', sentence2: 'I like this homemade lemonade', corpus: 'The line for his lemonade stand was wrapped around the block.' },
    { word: 'unfortunately', level: 'A2', meaning: 'in a regrettable, unlucky, or unsuitable manner', sentence1: "I'd love to come, but unfortunately, I have to work.", sentence2: 'Unfortunately I lost my keys', corpus: "It won't be finished for a few weeks. Unfortunately!" },
    { word: 'improve', level: 'A2', meaning: 'to get better or to make something better', sentence1: 'Her health has improved dramatically since she started on this new diet.', sentence2: 'The goal was to improve the efficiency of the department.', corpus: 'I hope my French will improve when I go to France.' },
    { word: 'furniture', level: 'A2', meaning: 'objects such as chairs, tables, and beds', sentence1: 'They have a lot of antique furniture.', sentence2: 'They bought some new furniture for the house.', corpus: 'They have been repaired many times and this furniture is over 60 years old.' },
    { word: 'cigarette', level: 'A2', meaning: 'a small paper tube filled with cut pieces of tobacco', sentence1: 'She lit a cigarette.', sentence2: 'There were three cigarette butts in the ashtray', corpus: 'I used to smoke a packet of cigarettes a day.' },
    { word: 'dangerous', level: 'A2', meaning: 'likely to injure or harm somebody', sentence1: 'The situation is extremely dangerous.', sentence2: "It's dangerous to take more than the recommended dose of tablets.", corpus: 'He is wanted for assault with a dangerous weapon.' },
    { word: 'horrible', level: 'A2', meaning: 'very bad or unpleasant', sentence1: 'That was a horrible thing to say!', sentence2: 'He looks horrible with that new haircut.', corpus: 'He realized that he had made a horrible mistake.' },
  ],

  B1: [
    { word: 'brochure', level: 'B1', meaning: 'a short booklet containing descriptive or advertising material', sentence1: 'We looked at some holiday brochures last night.', sentence2: 'There are brochures and helpful staff to guide you at the entrance.', corpus: 'This brochure needs circulating much more widely than at present.' },
    { word: 'embarrassed', level: 'B1', meaning: 'feeling ashamed or shy', sentence1: 'She was embarrassed at her own behaviour.', sentence2: 'She felt embarrassed about undressing in front of the doctor', corpus: 'He felt embarrassed when the teacher asked him to read his essay to the class.' },
    { word: 'enormous', level: 'B1', meaning: 'extremely large', sentence1: 'Their house is absolutely enormous!', sentence2: 'Universities are under enormous pressure financially.', corpus: 'We chose not to undertake the project because of the enormous costs involved.' },
    { word: 'foreigner', level: 'B1', meaning: 'a person who comes from another country', sentence1: 'I was so obviously a foreigner.', sentence2: "I can tell by your accent you're a foreigner in these parts.", corpus: 'I have always been regarded as a foreigner by the local folk.' },
    { word: 'reliable', level: 'B1', meaning: 'able to be trusted or believed', sentence1: "We can't write a report without reliable data", sentence2: 'He was a very reliable and honest man who would never betray anyone.', corpus: 'The figure is widely viewed as the most reliable one available.' },
    { word: 'scenery', level: 'B1', meaning: 'the attractive, natural things that you see in the countryside', sentence1: 'They stopped at the top of the hill to admire the scenery.', sentence2: 'We went for a drive to enjoy the scenery.', corpus: 'The change of scenery so far is working out for both sides.' },
    { word: 'situation', level: 'B1', meaning: 'circumstances; a state of affairs', sentence1: 'Her news put me in a difficult situation.', sentence2: 'I thought she handled the situation well.', corpus: 'There will be ambiguous situations in which learning should not be permitted.' },
    { word: 'souvenir', level: 'B1', meaning: 'something which you buy or keep to remember a special event', sentence1: 'I kept the ticket as a souvenir of my trip.', sentence2: 'I bought the ring as a souvenir of Greece.', corpus: 'Most of the souvenir shops along David Street were open.' },
    { word: 'spectacular', level: 'B1', meaning: 'extremely exciting or surprising', sentence1: 'The show was a spectacular success.', sentence2: 'He scored a spectacular goal in the second half.', corpus: 'The coastal road has spectacular scenery.' },
    { word: 'sociable', level: 'B1', meaning: 'Someone who enjoys being with people and meeting new people.', sentence1: "I'm not feeling very sociable this evening.", sentence2: 'She had always been very sociable but no longer felt like it.', corpus: 'Most members of the sandpiper family tend to be sociable.' },
  ],

  B2: [
    { word: 'adequately', level: 'B2', meaning: 'to a sufficient degree', sentence1: 'This is why taking care to rest adequately is a vital part of training.', sentence2: 'Drinking cool water can encourage you to stay adequately hydrated.', corpus: 'While some patients can be adequately cared for at home, others are best served by care in a hospital.' },
    { word: 'adventurous', level: 'B2', meaning: 'willing to try new and often difficult or dangerous things', sentence1: 'The island attracts adventurous travelers.', sentence2: 'Her design is an adventurous departure from what we usually see.', corpus: 'Many teachers would like to be more adventurous and creative.' },
    { word: 'anxiously', level: 'B2', meaning: 'in a worried or nervous way', sentence1: 'I am waiting for your reply anxiously.', sentence2: "They're were waiting anxiously for news about their son.", corpus: 'Residents are anxiously awaiting a decision.' },
    { word: 'burglary', level: 'B2', meaning: 'the crime of illegally entering a building and stealing things', sentence1: 'He was charged with burglary.', sentence2: 'Audio equipment was stolen in a burglary at the mall.', corpus: 'Homeowners were not home during the time frame of the burglary.' },
    { word: 'conveniently', level: 'B2', meaning: 'in a way that is useful, easy or quick', sentence1: 'The hotel is conveniently situated close to the beach.', sentence2: 'The house is conveniently situated near the station and the shops.', corpus: 'She conveniently forgot to mention that her husband would be at the party too' },
    { word: 'deceive', level: 'B2', meaning: 'to make someone believe something that is not true', sentence1: 'Do not try to deceive us about the content.', sentence2: 'The sound of the door closing deceived me into thinking they had gone out.', corpus: 'He was accused of deceiving the customer about the condition of the car.' },
    { word: 'genuine', level: 'B2', meaning: 'in a sincere way', sentence1: 'She always showed genuine concern for others.', sentence2: 'We are all genuinely interested in English literature.', corpus: 'He made a genuine attempt to improve conditions.' },
    { word: 'maintenance', level: 'B2', meaning: 'the act of keeping something in good condition', sentence1: 'Old houses require too much maintenance.', sentence2: 'The school pays for heating and the maintenance of the buildings.', corpus: 'The building has suffered from years of poor maintenance.' },
    { word: 'nuisance', level: 'B2', meaning: 'a person, thing, or situation that annoys you', sentence1: "It's such a nuisance having to rewrite those letters.", sentence2: 'Local residents claimed that the noise was causing a public nuisance', corpus: 'City leaders say vacant properties can often lead to neighborhood nuisances.' },
    { word: 'pessimistic', level: 'B2', meaning: 'always believing that bad things are likely to happen', sentence1: 'The doctors are pessimistic about his chances of recovery.', sentence2: "I think you're being far too pessimistic.", corpus: 'I am not being pessimistic here, just realistic.' },
    { word: 'picturesque', level: 'B2', meaning: 'charming or quaint in appearance', sentence1: 'The view of the mountains was very picturesque.', sentence2: 'Nature is the star of this tranquil and picturesque ride.', corpus: 'Netherlands is a really nice country, with many historical buildings and picturesque places.' },
    { word: 'tragedy', level: 'B2', meaning: 'an event or situation which is very sad', sentence1: "It's a tragedy that she died so young.", sentence2: 'His life was touched by hardship and personal tragedy.', corpus: 'The actual extent of the tragedy was only made public some days later.' },
  ],

  C1: medicalAdvancedWords.map((w) => ({ ...w, level: 'C1' })),

  C2: medicalAdvancedWords.map((w) => ({ ...w, level: 'C2' })),
};

// Get the adjacent levels for a given CEFR level
export function getAdjacentLevels(level: string): string[] {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const index = levels.indexOf(level.toUpperCase());

  if (index === -1) return ['B1', 'B2']; // Default fallback

  const result: string[] = [];

  // Add level below (if exists)
  if (index > 0) {
    result.push(levels[index - 1]);
  }

  // Add current level
  result.push(levels[index]);

  // Add level above (if exists)
  if (index < levels.length - 1) {
    result.push(levels[index + 1]);
  }

  return result;
}

// Get words for the given level and adjacent levels
export function getWordsForLevel(level: string, excludeWords: string[] = []): WordItem[] {
  const levels = getAdjacentLevels(level);
  const excludeSet = new Set(excludeWords.map((w) => w.toLowerCase()));

  const words: WordItem[] = [];

  for (const lvl of levels) {
    const levelWords = wordsByLevel[lvl] || [];
    for (const word of levelWords) {
      if (!excludeSet.has(word.word.toLowerCase())) {
        words.push(word);
      }
    }
  }

  return words;
}

// Look up a word's definition (meaning) from the static word list
export function getWordDefinition(word: string): string | null {
  const wordLower = word.toLowerCase();
  for (const level of Object.keys(wordsByLevel)) {
    const found = wordsByLevel[level].find((w) => w.word.toLowerCase() === wordLower);
    if (found) {
      return found.meaning;
    }
  }
  return null;
}

// Look up full word item from the static word list
export function getWordItem(word: string): WordItem | null {
  const wordLower = word.toLowerCase();
  for (const level of Object.keys(wordsByLevel)) {
    const found = wordsByLevel[level].find((w) => w.word.toLowerCase() === wordLower);
    if (found) {
      return found;
    }
  }
  return null;
}

// Get all words from all levels
export function getAllWords(): WordItem[] {
  const allWords: WordItem[] = [];
  for (const level of Object.keys(wordsByLevel)) {
    allWords.push(...wordsByLevel[level]);
  }
  return allWords;
}

// Get words for a specific level only
export function getWordsBySpecificLevel(level: string): WordItem[] {
  return wordsByLevel[level.toUpperCase()] || [];
}

// Get the higher level for a given CEFR level
export function getHigherLevel(level: string): string | null {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const index = levels.indexOf(level.toUpperCase());
  if (index === -1 || index >= levels.length - 1) return null;
  return levels[index + 1];
}

// Get the lower level for a given CEFR level
export function getLowerLevel(level: string): string | null {
  const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  const index = levels.indexOf(level.toUpperCase());
  if (index <= 0) return null;
  return levels[index - 1];
}

// Get words grouped by current, higher, and lower levels
export function getWordsGroupedByLevel(
  currentLevel: string,
  excludeWords: string[] = []
): {
  current: { level: string; words: WordItem[] };
  higher: { level: string | null; words: WordItem[] };
  lower: { level: string | null; words: WordItem[] };
} {
  const excludeSet = new Set(excludeWords.map((w) => w.toLowerCase()));
  const filterWords = (items: WordItem[]) =>
    items.filter((w) => !excludeSet.has(w.word.toLowerCase()));

  const higherLevel = getHigherLevel(currentLevel);
  const lowerLevel = getLowerLevel(currentLevel);
  const current = currentLevel.toUpperCase();
  const effectiveHigherLevel = higherLevel || current;

  return {
    current: {
      level: current,
      words: filterWords(getWordsBySpecificLevel(currentLevel)),
    },
    higher: {
      level: effectiveHigherLevel,
      words: filterWords(getWordsBySpecificLevel(effectiveHigherLevel)),
    },
    lower: {
      level: lowerLevel,
      words: lowerLevel ? filterWords(getWordsBySpecificLevel(lowerLevel)) : [],
    },
  };
}
