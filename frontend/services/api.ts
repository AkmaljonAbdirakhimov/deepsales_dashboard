// API Base URL - use relative path in production since nginx proxies /api to backend
// In browser, use empty string so services can append /api
// In SSR, use relative path as fallback
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : '';

// Import services
import * as fileService from './fileService';
import * as analysisService from './analysisService';
import * as statsService from './statsService';
import * as categoryService from './categoryService';

// Re-export interfaces from services
export type { Manager, HistoryPoint, VolumeDataPoint } from './statsService';
export type { UploadedFile, UploadResponse, AudioFile, Manager as ManagerName, ManagerLimitInfo } from './fileService';
export type { Category, Criterion } from './categoryService';

// Re-export all API functions
export const api = {
    // File operations
    uploadFiles: fileService.uploadFiles,
    getFiles: fileService.getFiles,
    getResults: fileService.getResults,
    deleteAudio: fileService.deleteAudio,
    getManagers: fileService.getManagers,
    getManagerLimits: fileService.getManagerLimits,
    createManager: fileService.createManager,
    updateManager: fileService.updateManager,
    deleteManager: fileService.deleteManager,

    // Analysis operations
    analyzeFiles: analysisService.analyzeFiles,

    // Stats operations
    getManagersStats: statsService.getManagersStats,
    getManagerHistory: statsService.getManagerHistory,
    getVolumeStats: statsService.getVolumeStats,
    getAudioStats: statsService.getAudioStats,

    // Category operations
    getCategories: categoryService.getCategories,
    createCategory: categoryService.createCategory,
    updateCategory: categoryService.updateCategory,
    deleteCategory: categoryService.deleteCategory,

    // Criterion operations
    createCriterion: categoryService.createCriterion,
    updateCriterion: categoryService.updateCriterion,
    deleteCriterion: categoryService.deleteCriterion,
};

