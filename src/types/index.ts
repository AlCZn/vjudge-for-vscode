export interface LoginResponse {
  status: "success" | "error";
  msg?: string;
}

export interface VJudgeConfig {
  username?: string;
  defaultOJ?: string;
  defaultLanguage?: string;
}

export interface SubmitParams {
  oj: string; // 如 'HDU'
  problemId: string; // 如 '1000'
  language: string; // 如 '1' 或 'C++'
  code: string;
}
