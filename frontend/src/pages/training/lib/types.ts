export type FileEntry = {
  id: string;
  file: File;
  name: string;
  size: number;
  ext: "pdf" | "docx" | "doc" | "txt";
  role: "textbook" | "question" | "answer";
};

export type ExamPair = {
  pairId: string;
  question: FileEntry;
  answer: FileEntry;
};

export type TrainingDataset = {
  version: string;
  created: string;
  priority_rule: "exam_over_textbook";
  training_config: {
    base_model: string;
    method: string;
    target_accuracy: number;
    language: string;
    domain: string;
    exam_weight_multiplier: number;
    instruction_template: string;
  };
  textbooks: { filename: string; size_bytes: number; format: string; role: string }[];
  exam_pairs: {
    pair_id: number;
    question_file: string;
    answer_file: string;
    priority: number;
    role: string;
  }[];
  bedrock_config: {
    s3_training_bucket: string;
    textbook_subfolder: string;
    exam_q_subfolder: string;
    exam_a_subfolder: string;
    manifest_filename: string;
    base_model_id: string;
    hyperparameters: {
      epochs: number;
      batch_size: number;
      learning_rate: number;
    };
  };
};

export type Page = "textbooks" | "exam" | "ready";
