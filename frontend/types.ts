export interface Manager {
    id: number;
    name: string;
    total_audios?: number;
    average_score?: number;
    category_scores?: Record<string, number>;
    category_counts?: Record<string, number>;
    criteria_scores?: Record<string, Record<string, number>>;
    talk_ratio?: {
        manager: number;
        customer: number;
    };
    average_duration?: number;
    category_mistakes?: Record<string, Record<string, number>>;
    client_complaints?: Record<string, number>; // Most common complaints from clients
    hours_assigned?: number;
    hours_used?: number;
    hours_remaining?: number;
}

export interface AudioFile {
    id: number;
    filename: string;
    original_name: string;
    manager_id: number;
    manager_name: string;
    status: 'pending' | 'processing' | 'completed' | 'error';
    upload_date: string;
    overall_score?: number;
}

export interface TranscriptionSegment {
    speaker: 'manager' | 'client' | 'system';
    text: string;
    timestamp: string;
}

export interface Transcription {
    id: number;
    audio_file_id: number;
    full_text: string;
    segments: TranscriptionSegment[];
}

export interface Analysis {
    id: number;
    audio_file_id: number;
    overall_score: number;
    explanation: string;
    created_at: string;
}

export interface FullAnalysisResult {
    file: AudioFile;
    transcription: Transcription | null;
    analysis: Analysis | null;
}

export interface HistoryPoint {
    upload_date: string;
    overall_score: number;
}

