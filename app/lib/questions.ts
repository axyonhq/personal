export type Option = {
  id: string;
  letter?: string;
  label: string;
};

export type Question = {
  id: string;
  prompt: string;
  hint?: string;
  placeholder?: string;
} & (
  | { type: "text" | "textarea" }
  | { type: "number"; min?: number; max?: number }
  | { type: "single" | "multi" | "yesno"; options: Option[] }
  | { type: "traits"; options: string[]; max: number }
  | { type: "driver" }
  | { type: "swear" }
);

export type FieldValue = string | string[];
export type Answers = Record<string, FieldValue>;

export const feminineTraits = [
  "Adoring",
  "Affectionate",
  "Caring",
  "Charming",
  "Cheerful",
  "Classy",
  "Composed",
  "Considerate",
  "Cuddly",
  "Delicate",
  "Demure",
  "Devoted",
  "Doting",
  "Elegant",
  "Empathetic",
  "Feminine",
  "Flirty",
  "Forgiving",
  "Gentle",
  "Girly",
  "Good listener",
  "Graceful",
  "Gracious",
  "Homemaker",
  "Hospitable",
  "Humble",
  "Intuitive",
  "Kind",
  "Ladylike",
  "Loyal",
  "Maternal",
  "Modest",
  "Nurturing",
  "Patient",
  "Playful",
  "Poised",
  "Polished",
  "Polite",
  "Radiant",
  "Refined",
  "Respectful",
  "Romantic",
  "Sensual",
  "Soft",
  "Soft-spoken",
  "Stylish",
  "Submissive",
  "Supportive",
  "Sweet",
  "Tender",
  "Thoughtful",
  "Warm",
  "Warm-hearted",
  "Well-groomed",
  "Yielding",
];

export const questions: Question[] = [
  {
    id: "how-described",
    type: "textarea",
    prompt: "How would your friends and family describe you?",
    hint: "Not how you describe yourself. We will be checking, and they are usually ruder.",
    placeholder: "Be specific. “Nice” is an automatic no.",
  },
  {
    id: "traits",
    type: "traits",
    prompt: "What are your top five character traits?",
    hint: "Pick up to five. These are the ones Nick actually looks for. If you cannot find yourself on this list, that is also an answer.",
    options: feminineTraits,
    max: 5,
  },
  {
    id: "flowers",
    type: "text",
    prompt: "What are your favourite type of flowers?",
    hint: "Nick will guarantee to get you new flowers at least once a week, at a random point in time — not just birthdays or holidays.",
    placeholder: "Peonies. Roses. Whatever makes you stupid.",
  },
  {
    id: "sweet",
    type: "text",
    prompt: "What is your favourite type of sweet?",
    hint: "Nick loves to randomly surprise his girlfriend with her favourite treats.",
    placeholder: "Be honest. He will weaponise this information.",
  },
  {
    id: "food",
    type: "text",
    prompt: "What is your favourite type of food?",
    hint: "Nick loves to make sure you always have your favourite food in your tummy, a nice amount of orgasms every week, and good sleep.",
    placeholder: "Cuisine, dish, or a very specific craving.",
  },
  {
    id: "humour",
    type: "multi",
    prompt: "What type of humour are you willing to engage in with Nick if you are successful?",
    hint: "Please select one or more of the following. This is a values question, allegedly.",
    options: [
      { id: "racism", letter: "A", label: "Racism" },
      { id: "homophobia", letter: "B", label: "Homophobia" },
      { id: "fat", letter: "C", label: "Towards fat people" },
      { id: "retards", letter: "D", label: "Towards retards" },
      { id: "all", letter: "E", label: "All of the above" },
      { id: "none", letter: "F", label: "None of the above" },
    ],
  },
  {
    id: "describe-nick",
    type: "textarea",
    prompt: "How would you describe Nick from what you know about him so far, in one paragraph or less?",
    hint: "Boosting his ego may result in extra application points.",
    placeholder: "Go on. He can take it. He cannot, actually. Lay it on.",
  },
  {
    id: "spicy",
    type: "multi",
    prompt: "Which of these are you interested in participating in?",
    hint: "Please select one or more of the following.",
    options: [
      { id: "roleplay", letter: "A", label: "Sexual role play" },
      { id: "content", letter: "B", label: "Creating spicy content together, for your eyes only" },
      { id: "risky", letter: "C", label: "Risky sex in risky places" },
      { id: "marathon", letter: "D", label: "A weekend sex marathon" },
      { id: "all", letter: "E", label: "All of the above" },
      { id: "none", letter: "F", label: "None of the above" },
    ],
  },
  {
    id: "frequency",
    type: "single",
    prompt: "How many times per week would you like to have sex?",
    hint: "Be realistic. Then ignore that, and be honest.",
    options: [
      { id: "1-2", letter: "A", label: "1–2" },
      { id: "2-5", letter: "B", label: "2–5" },
      { id: "5-7", letter: "C", label: "5–7" },
      { id: "7-14", letter: "D", label: "7–14" },
      { id: "15", letter: "E", label: "15+" },
    ],
  },
  {
    id: "screamer",
    type: "yesno",
    prompt: "Are you a screamer in the bedroom?",
    hint: "Nick needs to know this to work out if you need soundproofing in his house.",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  },
  {
    id: "children",
    type: "number",
    prompt: "How many children would you like to have with Nick if successful?",
    hint: "A number. Not a vibe. Not “however many he wants” unless that is actually the number.",
    min: 0,
    max: 20,
  },
  {
    id: "roleplay-street",
    type: "text",
    prompt: "You’re walking down the street. You’re on your own, listening to music. A big handsome guy comes up to you. He’s charismatic, funny, he flirts with you. He opens with: “Hey, beautiful.” What is the first thing you do in that moment?",
    hint: "Short line. First instinct, not the version you’d tell your group chat.",
    placeholder: "One line.",
  },
  {
    id: "roleplay-work",
    type: "textarea",
    prompt: "Nick is really locked in. He’s got lots on his plate, and he’s working 12 or 14 hours a day. What do you do?",
    hint: "Do you try to spend time with him? Do you try to distract him? Do you help him — and if so, how?",
    placeholder: "Show your working.",
  },
  {
    id: "roleplay-cuddle",
    type: "textarea",
    prompt: "Nick wakes up. He’s super tired. He said he’s going to be working all day and he’s got something important to finish. Then he says he’s just going to stay in bed and cuddle you. What do you say to Nick in that moment?",
    placeholder: "Verbatim, please.",
  },
  {
    id: "driver",
    type: "driver",
    prompt: "Given you are a woman, are you a good driver?",
    hint: "Simple yes or no.",
  },
  {
    id: "funnier",
    type: "single",
    prompt: "Who do you think is funnier?",
    options: [
      { id: "you", letter: "A", label: "You" },
      { id: "nick", letter: "B", label: "Nick" },
      { id: "equal", letter: "C", label: "It’s equal" },
    ],
  },
  {
    id: "support",
    type: "textarea",
    prompt: "How can Nick best support you to make you as happy as possible, make you feel as loved as possible, and make you the best version of yourself possible?",
    hint: "This is the grown-up question. Try not to waste it.",
    placeholder: "What actually works on you.",
  },
  {
    id: "orgasm",
    type: "yesno",
    prompt: "Will it be a problem for you if Nick always ensures that you have a leg-shaking orgasm before he has an orgasm?",
    hint: "Simple yes or no.",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  },
  {
    id: "swear",
    type: "swear",
    prompt:
      "Do you solemnly swear to never be a boss-bitch independent woman around Nick? Because if you let him lead and you submit to him, he will have your best interest at heart and make sure that you are happy, healthy, and feel loved.",
    hint: "There is no wrong answer. But if you get it wrong, the application will automatically close.",
  },
  {
    id: "body-count",
    type: "single",
    prompt: "What is your body count?",
    options: [
      { id: "0-5", letter: "A", label: "0–5" },
      { id: "5-10", letter: "B", label: "5–10" },
      { id: "10+", letter: "C", label: "10+" },
      { id: "0", letter: "D", label: "0" },
    ],
  },
  {
    id: "work-hard",
    type: "single",
    prompt:
      "If Nick’s working really hard, drinking lots of coffee, training really hard, and doesn’t have a lot of time for you — but he promises he will make at least one night a week for you to do something thoughtful — will you:",
    options: [
      { id: "hissy", letter: "A", label: "Have a hissy fit" },
      {
        id: "support",
        letter: "B",
        label:
          "Try to support him in his work, because it’s the most important thing to him, and you know that if he feels supported in his work then he will love and cherish you",
      },
      { id: "cunt", letter: "C", label: "Call him a cunt" },
      { id: "dick", letter: "D", label: "Take your clothes off and sit on his dick" },
    ],
  },
  {
    id: "final",
    type: "textarea",
    prompt: "Do you have any final information you would like to hand over to the team before submitting your application?",
    hint: "This is to put your best foot forward and optimise your chances of landing on the candidate shortlist.",
    placeholder: "Closing statement, references, or a threat. Your call.",
  },
];

export function isComplete(question: Question, value: FieldValue | undefined): boolean {
  switch (question.type) {
    case "text":
    case "textarea":
      return typeof value === "string" && value.trim().length > 0;
    case "number":
      return (
        typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(Number(value))
      );
    case "single":
    case "yesno":
      return typeof value === "string" && value.length > 0;
    case "multi":
      return Array.isArray(value) && value.length > 0;
    case "traits":
      return Array.isArray(value) && value.length >= 1 && value.length <= question.max;
    case "driver":
      return value === "no";
    case "swear":
      return value === "yes";
  }
}

export function toggleExclusiveMulti(
  current: string[],
  id: string,
  options: Option[],
): string[] {
  const regularIds = options
    .filter((option) => option.id !== "all" && option.id !== "none")
    .map((option) => option.id);

  if (id === "none") return ["none"];
  if (id === "all") return [...regularIds, "all"];

  let next = current.filter((item) => item !== "none" && item !== "all");
  next = next.includes(id) ? next.filter((item) => item !== id) : [...next, id];

  if (regularIds.length > 0 && regularIds.every((item) => next.includes(item))) {
    return [...regularIds, "all"];
  }

  return next;
}
