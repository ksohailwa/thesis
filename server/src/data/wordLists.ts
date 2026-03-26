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

  C1: [
    { word: 'affluent', level: 'C1', meaning: 'having a lot of money', sentence1: 'The restaurant is popular with affluent businessmen.', sentence2: "An ambulance was dispatched to the Jamiesons' home, in an affluent neighborhood of Toronto.", corpus: 'More research on the complex and flexible contemporary relationships between affluent older people and their children is required.' },
    { word: 'itinerary', level: 'C1', meaning: 'a list of places that you plan to visit on a journey', sentence1: 'Although the itinerary involved a visit to Duisburg, for some unknown reasons we never went there.', sentence2: 'The band has now added more concerts to its itinerary.', corpus: "The President's itinerary includes visits to Boston and New York" },
    { word: 'deteriorate', level: 'C1', meaning: 'to become worse', sentence1: 'Her condition deteriorated rapidly.', sentence2: 'Exposure to rain and sun will gradually deteriorate the paint.', corpus: 'She went into the hospital when her condition began to deteriorate.' },
    { word: 'envisage', level: 'C1', meaning: 'to imagine something happening', sentence1: "The police don't envisage any trouble at the festival.", sentence2: "I'm trying to envisage you on a surfboard", corpus: 'It is difficult to envisage how people will react.' },
    { word: 'disastrous', level: 'C1', meaning: 'causing great harm', sentence1: 'It was a disastrous start to the season for the team.', sentence2: 'Lowering interest rates could have disastrous consequences for the economy.', corpus: 'His failure to back up the computer files had disastrous consequences.' },
    { word: 'inevitable', level: 'C1', meaning: 'certain to happen and unable to be avoided or prevented', sentence1: 'The accident was the inevitable consequence of carelessness.', sentence2: 'Getting wet is inevitable if you are going to try to give your dog a bath', corpus: 'It is inevitable that some industries will lose their export subsidies in the process.' },
    { word: 'juvenile', level: 'C1', meaning: 'relating to young people', sentence1: 'She criticized his juvenile behavior at the party.', sentence2: 'What can be done to help these juvenile delinquents turn away from crime?', corpus: 'She works to keep juveniles away from drugs.' },
    { word: 'obsolete', level: 'C1', meaning: 'no longer used because something new has been invented', sentence1: 'Will books become obsolete because of computers?', sentence2: 'That system is completely obsolete.', corpus: "I was told my old printer is obsolete and I can't get replacement parts" },
    { word: 'persuasive', level: 'C1', meaning: 'able to make people agree to do something', sentence1: 'He can be very persuasive.', sentence2: 'He is a persuasive speaker', corpus: "We weren't shown any persuasive evidence that he had committed the crime." },
    { word: 'prestigious', level: 'C1', meaning: 'respected and admired', sentence1: 'My parents wanted me to go to a more prestigious university.', sentence2: 'The Gold Cup is one of the most prestigious events in the racing calendar.', corpus: 'Sometimes individuals increase their esteem by being members of some important or prestigious associations.' },
    { word: 'prosperous', level: 'C1', meaning: 'rich and successful', sentence1: 'He is a prosperous car dealer.', sentence2: 'Farmers are more prosperous in the south of the country.', corpus: 'The land was cultivated, and the country became prosperous.' },
    { word: 'rebellious', level: 'C1', meaning: 'refusing to obey rules', sentence1: 'He is a rebellious teenager', sentence2: 'A child placed in that position becomes lazy, resentful, or rebellious.', corpus: 'John has the reputation of being the bit more rebellious of the two.' },
  ],

  C2: [
    { word: 'affectionate', level: 'C2', meaning: 'showing that you like or love someone', sentence1: 'She is very affectionate towards her mother.', sentence2: 'She is attentive and affectionate, but most of all she is a sweet mother.', corpus: 'The gentle, affectionate toying with his past existence came to an end' },
    { word: 'anonymous', level: 'C2', meaning: 'not giving a name', sentence1: 'The winner has asked to remain anonymous', sentence2: 'The money was donated by a local businessman who wishes to remain anonymous.', corpus: 'Our aim must be a foot and mouth policy that is not anonymous.' },
    { word: 'conceited', level: 'C2', meaning: 'too proud of yourself and your actions', sentence1: 'I find him very conceited.', sentence2: "It's very conceited of you to assume that your work is always the best.", corpus: 'Is not the attitude we are adopting somewhat conceited and arrogant?' },
    { word: 'hierarchical', level: 'C2', meaning: 'using a system that arranges things according to their importance', sentence1: 'The company has a very hierarchical structure.', sentence2: "The company's structure is rigidly hierarchical.", corpus: 'Dogs kept some of their hierarchical instincts, replacing alpha wolves with their human masters.' },
    { word: 'hypocritical', level: 'C2', meaning: 'behaving in a way that does not meet the moral standards or match the opinions that you claim to have', sentence1: 'Having told Tom that he should not accept any money from her, it would be rather hypocritical if I did.', sentence2: "It would be hypocritical of me to have a church wedding when I don't believe in God", corpus: 'Yet Bianco is nowhere near as hypocritical in his stance as Barnes.' },
    { word: 'inconceivable', level: 'C2', meaning: 'impossible to imagine', sentence1: 'I find it inconceivable that she could be a killer.', sentence2: 'It is inconceivable that the minister was not aware of the problem.', corpus: 'The thought of leaving her family was inconceivable to her.' },
    { word: 'intriguing', level: 'C2', meaning: 'very interesting', sentence1: 'These discoveries raise intriguing questions.', sentence2: 'He found her intriguing.', corpus: 'These findings have an intriguing connection to research on morality.' },
    { word: 'advocate', level: 'C2', meaning: 'to express support for a particular idea', sentence1: "I certainly wouldn't advocate the use of violence.", sentence2: 'To date, the health advocates have helped more than thousand people.', corpus: 'I would advocate a system that is fair to everyone.' },
    { word: 'embarrass', level: 'C2', meaning: 'to make someone feel ashamed', sentence1: "My dad's always embarrassing me in front of my friends.", sentence2: 'Her questions about my private life embarrassed me.', corpus: 'It embarrassed her to meet strange men in the corridor at night.' },
    { word: 'prosecute', level: 'C2', meaning: 'to officially accuse someone of committing a crime', sentence1: 'He was prosecuted for fraud.', sentence2: 'Shoplifters will be prosecuted.', corpus: 'The company was prosecuted for breaching the Health and Safety Act' },
    { word: 'speculate', level: 'C2', meaning: 'to guess possible answers to a question', sentence1: 'The police refused to speculate about the cause of the accident.', sentence2: 'The newspapers have speculated that they will get married next year.', corpus: 'We all speculated about the reasons for her resignation.' },
    { word: 'conscience', level: 'C2', meaning: 'the part of you that judges how moral your own actions are', sentence1: "My conscience is clear because I've done nothing wrong", sentence2: 'My conscience would really bother me if I wore a fur coat.', corpus: 'Only his own scientific conscience may guide the scholar.' },
    { word: 'lucrative', level: 'C2', meaning: 'producing a large amount of money', sentence1: 'It is no secret that many youngsters want a lucrative job.', sentence2: 'Had the plan worked it would have proved highly lucrative.', corpus: "The new manager's mission was to turn the failing store into a lucrative operation" },
    { word: 'unanimous', level: 'C2', meaning: 'having, or showing, complete agreement', sentence1: 'The jury was unanimous in finding him guilty.', sentence2: 'The voices in favour of its amendment were unanimous.', corpus: 'She was the unanimous choice of the selection committee.' },
    { word: 'vulnerable', level: 'C2', meaning: 'easy to hurt or attack physically or emotionally', sentence1: "He's more vulnerable to infection because of his injuries.", sentence2: 'Animals are at their most vulnerable when searching for food for their young', corpus: 'Although many perennial herbs are hardy and often withstand freezing temperatures when mature, the seedlings are more vulnerable to the cold.' },
  ],
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

  return {
    current: {
      level: currentLevel.toUpperCase(),
      words: filterWords(getWordsBySpecificLevel(currentLevel)),
    },
    higher: {
      level: higherLevel,
      words: higherLevel ? filterWords(getWordsBySpecificLevel(higherLevel)) : [],
    },
    lower: {
      level: lowerLevel,
      words: lowerLevel ? filterWords(getWordsBySpecificLevel(lowerLevel)) : [],
    },
  };
}
