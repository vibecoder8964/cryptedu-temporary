import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { FileEntry, ExamPair, TrainingDataset } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export function getExt(name: string): FileEntry["ext"] {
  return name.split(".").pop()?.toLowerCase() as FileEntry["ext"];
}

export function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function buildFileEntry(file: File, role: FileEntry["role"]): FileEntry {
  return {
    id: makeId(),
    file,
    name: file.name,
    size: file.size,
    ext: getExt(file.name),
    role,
  };
}

export function buildDataset(
  textbooks: FileEntry[],
  examPairs: ExamPair[]
): TrainingDataset {
  return {
    version: "1.1",
    created: new Date().toISOString(),
    priority_rule: "exam_over_textbook",
    training_config: {
      base_model: "google/gemma-2-2b-it",
      method: "QLoRA",
      target_accuracy: 0.87,
      language: "ms",
      domain: "KPM_Malaysia_secondary",
      exam_weight_multiplier: 3,
      instruction_template:
        "### Soalan:\n{question}\n\n### Jawapan (mengikut skema pemarkahan):\n{answer}",
    },
    textbooks: textbooks.map((f) => ({
      filename: f.name,
      size_bytes: f.size,
      format: f.ext,
      role: "background_knowledge",
    })),
    exam_pairs: examPairs.map((p, i) => ({
      pair_id: i + 1,
      question_file: p.question.name,
      answer_file: p.answer.name,
      priority: 10,
      role: "primary_training_signal",
    })),
    colab_instructions: {
      drive_folder: "SLM_Training",
      textbook_subfolder: "textbooks",
      exam_q_subfolder: "exam_questions",
      exam_a_subfolder: "exam_answers",
      manifest_filename: "slm_manifest.json",
    },
  };
}

export function downloadJSON(data: object, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
