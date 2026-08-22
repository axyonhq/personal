export type Question = {
  id: string;
  prompt: string;
  hint: string;
  placeholder: string;
};

export const questions: Question[] = [
  {
    id: "how-described",
    prompt: "How would your friends and family describe you?",
    hint: "Not how you describe yourself. We will be checking, and they are usually ruder.",
    placeholder: "Be specific. “Nice” is an automatic no.",
  },
];
