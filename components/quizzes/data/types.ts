export interface QuizData {
  question: string;
  options: string[];
  correctAnswers: number[];
  hint: string;
  explanation: string;
}

export interface FullQuizData extends QuizData {
  chapter?: string;
  alternates?: QuizData[];
}

export interface Course {
  title: string;
  quizzes: string[];
}

export interface QuizDataStructure {
  courses: Record<string, Course>;
  quizzes: Record<string, FullQuizData>;
}
