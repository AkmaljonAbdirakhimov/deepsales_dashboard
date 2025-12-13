"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/services/api';
import { ArrowLeft, Play, Pause } from 'lucide-react';
import { clsx } from 'clsx';
import { parseTimestamp as parseTimestampUtil } from '@/utils/dateTime';

interface TranscriptionSegment {
    speaker: 'manager' | 'client' | 'system';
    text: string;
    timestamp: string;
}

export default function TranscriptionPage() {
    const router = useRouter();
    const params = useParams();
    const fileId = parseInt(params.id as string);

    const [loading, setLoading] = useState(true);
    const [transcription, setTranscription] = useState<TranscriptionSegment[]>([]);
    const [managerName, setManagerName] = useState('');
    const [audioUrl, setAudioUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [highlightedSegment, setHighlightedSegment] = useState<number | null>(null);

    const audioRef = useRef<HTMLAudioElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!fileId || fileId === 0) {
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                const result = await api.getResults(fileId);

                if (result.transcription && result.transcription.segments) {
                    // Validate and cast segments to ensure speaker is one of the expected values
                    const validatedSegments = result.transcription.segments.map(seg => ({
                        ...seg,
                        speaker: (seg.speaker === 'manager' || seg.speaker === 'client' || seg.speaker === 'system')
                            ? seg.speaker
                            : 'system' as 'manager' | 'client' | 'system'
                    }));
                    setTranscription(validatedSegments);
                }

                if (result.file) {
                    setManagerName(result.file.manager_name);
                    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
                    // Use file_path if available (includes company folder), otherwise fallback to filename
                    const filePath = (result.file as any).file_path || result.file.filename;
                    setAudioUrl(`${API_BASE_URL}/uploads/${filePath}`);
                }
            } catch (error) {
                console.error('Error fetching transcription:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [fileId]);

    // Use the util function, but return 0 instead of null for this component's needs
    const parseTimestamp = (timestamp: string): number => {
        return parseTimestampUtil(timestamp) || 0;
    };

    // Format seconds to MM:SS
    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Handle audio events
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const updateTime = () => {
            setCurrentTime(audio.currentTime);

            // Find which segment should be highlighted based on current time
            let activeIndex = null;
            for (let i = 0; i < transcription.length; i++) {
                const segmentTime = parseTimestamp(transcription[i].timestamp);
                const nextSegmentTime = i < transcription.length - 1
                    ? parseTimestamp(transcription[i + 1].timestamp)
                    : duration;

                if (audio.currentTime >= segmentTime && audio.currentTime < nextSegmentTime) {
                    activeIndex = i;
                    break;
                }
            }

            if (activeIndex !== highlightedSegment) {
                setHighlightedSegment(activeIndex);

                // Auto-scroll to highlighted segment
                if (activeIndex !== null && chatContainerRef.current) {
                    const segmentElement = chatContainerRef.current.children[activeIndex] as HTMLElement;
                    if (segmentElement) {
                        segmentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }
            }
        };

        const handleLoadedMetadata = () => {
            setDuration(audio.duration);
        };

        const handleEnded = () => {
            setIsPlaying(false);
            setCurrentTime(0);
        };

        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.removeEventListener('timeupdate', updateTime);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, [transcription, duration, highlightedSegment]);

    const togglePlayPause = () => {
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
        } else {
            audio.play();
        }
        setIsPlaying(!isPlaying);
    };

    const seekToTimestamp = (timestamp: string) => {
        const audio = audioRef.current;
        if (!audio) return;

        const seconds = parseTimestamp(timestamp);
        audio.currentTime = seconds;
        setCurrentTime(seconds);

        if (!isPlaying) {
            audio.play();
            setIsPlaying(true);
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const audio = audioRef.current;
        if (!audio || !duration) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newTime = percentage * duration;

        audio.currentTime = newTime;
        setCurrentTime(newTime);
    };

    // Helper function to determine speaker type and display info
    const getSpeakerInfo = (speaker: string) => {
        const speakerLower = speaker.toLowerCase();

        if (speakerLower === 'manager') {
            return {
                isManager: true,
                displayName: managerName,
                initial: managerName.charAt(0).toUpperCase(),
                bgColor: 'bg-indigo-600'
            };
        } else if (speakerLower === 'client') {
            return {
                isManager: false,
                displayName: 'Mijoz',
                initial: 'C',
                bgColor: 'bg-gray-500'
            };
        } else if (speakerLower === 'system') {
            return {
                isManager: false,
                displayName: 'Tizim',
                initial: 'S',
                bgColor: 'bg-yellow-500'
            };
        } else {
            // Fallback for any unexpected values
            return {
                isManager: false,
                displayName: speaker || 'Noma\'lum',
                initial: (speaker || '?').charAt(0).toUpperCase(),
                bgColor: 'bg-gray-400'
            };
        }
    };

    if (!fileId || fileId === 0) {
        return (
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft size={20} />
                    Orqaga
                </button>
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <p className="text-gray-600">Fayl ID topilmadi</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Yuklanmoqda...</p>
                </div>
            </div>
        );
    }

    if (!transcription || transcription.length === 0) {
        return (
            <div className="max-w-4xl mx-auto">
                <button
                    onClick={() => router.back()}
                    className="mb-6 flex items-center gap-2 text-gray-600 hover:text-gray-900"
                >
                    <ArrowLeft size={20} />
                    Orqaga
                </button>
                <div className="bg-white rounded-lg shadow p-8 text-center">
                    <p className="text-gray-600">Transkripsiya topilmadi</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-8">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <button
                    onClick={() => router.back()}
                    className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                    <ArrowLeft size={20} />
                    Orqaga
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Transkripsiya</h1>
                <div className="w-24"></div>
            </div>

            {/* Audio Player */}
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
                <div className="flex items-center gap-4 mb-4">
                    <button
                        onClick={togglePlayPause}
                        className="flex items-center justify-center w-12 h-12 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                    >
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                    </button>
                    <div className="flex-1">
                        <div
                            className="h-2 bg-gray-200 rounded-full cursor-pointer relative"
                            onClick={handleProgressClick}
                        >
                            <div
                                className="h-full bg-indigo-600 rounded-full transition-all"
                                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-sm text-gray-600 mt-1">
                            <span>{formatTime(currentTime)}</span>
                            <span>{formatTime(duration)}</span>
                        </div>
                    </div>
                </div>
                <audio ref={audioRef} src={audioUrl} preload="metadata" />
            </div>

            {/* Chat Interface */}
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-900">Suhbat</h2>
                </div>
                <div
                    ref={chatContainerRef}
                    className="h-[600px] overflow-y-auto p-6 space-y-4"
                >
                    {transcription.map((segment, index) => {
                        const speakerInfo = getSpeakerInfo(segment.speaker);
                        const isHighlighted = highlightedSegment === index;

                        return (
                            <div
                                key={index}
                                className={clsx(
                                    'flex gap-3 transition-all cursor-pointer rounded-lg p-3',
                                    isHighlighted && 'bg-indigo-50 border-2 border-indigo-200',
                                    !isHighlighted && 'hover:bg-gray-50'
                                )}
                                onClick={() => seekToTimestamp(segment.timestamp)}
                            >
                                <div className={clsx(
                                    'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm',
                                    speakerInfo.bgColor
                                )}>
                                    {speakerInfo.initial}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-semibold text-gray-900">
                                            {speakerInfo.displayName}
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono">
                                            {segment.timestamp}
                                        </span>
                                    </div>
                                    <p className="text-gray-700 whitespace-pre-wrap break-words">
                                        {segment.text}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
