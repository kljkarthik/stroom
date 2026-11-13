import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';
import { QuizVersion, QuizQuestion, QuizOption } from '../../types';
import {
  Sparkles,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Edit2,
  ArrowUp,
  ArrowDown,
  Eye,
  Send,
  Smartphone,
  Layers,
  HelpCircle,
  X,
  Check,
  RefreshCw,
  FolderArchive,
  ChevronRight,
  ShieldAlert
} from 'lucide-react';
import { QuizProgress } from '../onboarding/QuizProgress';
import { QuizQuestion as QuizQuestionComp } from '../onboarding/QuizQuestion';
import { QuizOptionCard } from '../onboarding/QuizOptionCard';
import { QuizNavigation } from '../onboarding/QuizNavigation';

export const AdminDashboard: React.FC = () => {
  const [overview, setOverview] = useState<any>(null);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [activeVersion, setActiveVersion] = useState<QuizVersion | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [previewMode, setPreviewMode] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Question editing modal state
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [isNewQuestion, setIsNewQuestion] = useState<boolean>(false);
  const [questionFormData, setQuestionFormData] = useState<any>({
    question_text: '',
    description: '',
    question_type: 'single',
    is_required: 1,
    min_selections: 1,
    max_selections: 1,
  });

  // Option modal state
  const [editingOptionQuestionId, setEditingOptionQuestionId] = useState<string | null>(null);
  const [optionFormData, setOptionFormData] = useState<{ label: string; stable_value: string }>({
    label: '',
    stable_value: '',
  });

  // Publication confirmation modal
  const [showPublishModal, setShowPublishModal] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);

  // Mobile preview interactive state
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string[]>>({});

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [overviewData, quizzesData] = await Promise.all([
        api.getAdminOverview(),
        api.getAdminQuizzes(),
      ]);
      setOverview(overviewData);
      setQuizzes(quizzesData.quizzes || []);

      // Default select draft version if available, otherwise published version
      const defaultVerId =
        overviewData.draft_version?.id ||
        overviewData.published_version?.id ||
        quizzesData.quizzes?.[0]?.versions?.[0]?.id;

      if (defaultVerId) {
        setSelectedVersionId(defaultVerId);
        await loadVersionTree(defaultVerId);
      }
    } catch (err: any) {
      console.error('Failed to load admin data:', err);
      setStatusMessage({ type: 'error', text: err.message || 'Failed to load admin data' });
    } finally {
      setIsLoading(false);
    }
  };

  const loadVersionTree = async (versionId: string) => {
    try {
      const data = await api.getAdminVersion(versionId);
      setActiveVersion(data.version);
      setPreviewIndex(0);
      setPreviewAnswers({});
    } catch (err: any) {
      console.error('Failed to load version tree:', err);
      setStatusMessage({ type: 'error', text: 'Failed to load version details' });
    }
  };

  const handleSelectVersion = (versionId: string) => {
    setSelectedVersionId(versionId);
    loadVersionTree(versionId);
  };

  const handleCreateDraft = async () => {
    if (!quizzes[0]) return;
    try {
      const res = await api.createDraft(quizzes[0].id);
      setStatusMessage({ type: 'success', text: `Draft version ${res.version_number} created!` });
      await loadAdminData();
      if (res.draft_version_id) {
        handleSelectVersion(res.draft_version_id);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to create draft' });
    }
  };

  // Question CRUD
  const handleOpenAddQuestion = () => {
    setIsNewQuestion(true);
    setQuestionFormData({
      question_text: '',
      description: '',
      question_type: 'single',
      is_required: 1,
      min_selections: 1,
      max_selections: 1,
    });
    setEditingQuestion({} as any);
  };

  const handleOpenEditQuestion = (q: QuizQuestion) => {
    setIsNewQuestion(false);
    setEditingQuestion(q);
    setQuestionFormData({
      question_text: q.question_text,
      description: q.description || '',
      question_type: q.question_type,
      is_required: q.is_required,
      min_selections: q.min_selections,
      max_selections: q.max_selections,
    });
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVersion) return;

    try {
      if (isNewQuestion) {
        await api.createQuestion({
          quiz_version_id: activeVersion.id,
          ...questionFormData,
        });
        setStatusMessage({ type: 'success', text: 'Question added to draft!' });
      } else if (editingQuestion) {
        await api.updateQuestion(editingQuestion.id, questionFormData);
        setStatusMessage({ type: 'success', text: 'Question updated!' });
      }
      setEditingQuestion(null);
      await loadVersionTree(activeVersion.id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to save question' });
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await api.deleteQuestion(questionId);
      setStatusMessage({ type: 'success', text: 'Question deleted' });
      if (activeVersion) await loadVersionTree(activeVersion.id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete question' });
    }
  };

  const handleMoveQuestion = async (index: number, direction: 'up' | 'down') => {
    if (!activeVersion?.questions) return;
    const questions = [...activeVersion.questions];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= questions.length) return;

    const temp = questions[index];
    questions[index] = questions[targetIndex];
    questions[targetIndex] = temp;

    const questionIds = questions.map((q) => q.id);
    try {
      await api.reorderQuestions(questionIds);
      await loadVersionTree(activeVersion.id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to reorder' });
    }
  };

  // Option CRUD
  const handleOpenAddOption = (questionId: string) => {
    setEditingOptionQuestionId(questionId);
    setOptionFormData({ label: '', stable_value: '' });
  };

  const handleSaveOption = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOptionQuestionId || !activeVersion) return;

    try {
      await api.addOption(editingOptionQuestionId, optionFormData);
      setStatusMessage({ type: 'success', text: 'Option added!' });
      setEditingOptionQuestionId(null);
      await loadVersionTree(activeVersion.id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to add option' });
    }
  };

  const handleDeleteOption = async (optionId: string) => {
    if (!activeVersion) return;
    try {
      await api.deleteOption(optionId);
      setStatusMessage({ type: 'success', text: 'Option deleted' });
      await loadVersionTree(activeVersion.id);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Failed to delete option' });
    }
  };

  // Publication
  const handlePublish = async () => {
    if (!activeVersion) return;
    setIsPublishing(true);
    try {
      const res = await api.publishVersion(activeVersion.id);
      setStatusMessage({ type: 'success', text: res.message });
      setShowPublishModal(false);
      await loadAdminData();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Publication failed' });
    } finally {
      setIsPublishing(false);
    }
  };

  // Mobile preview interaction helper
  const handlePreviewToggleOption = (questionId: string, optionId: string, isSingle: boolean) => {
    setPreviewAnswers((prev) => {
      const current = prev[questionId] || [];
      if (isSingle) {
        return { ...prev, [questionId]: [optionId] };
      } else {
        if (current.includes(optionId)) {
          return { ...prev, [questionId]: current.filter((id) => id !== optionId) };
        } else {
          return { ...prev, [questionId]: [...current, optionId] };
        }
      }
    });
  };

  const isDraft = activeVersion?.publication_status === 'draft';

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 pb-28 animate-fade-in text-left text-stroom-black">
      {/* Top Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-stroom-cream border border-stroom-orange/30 text-stroom-deep text-xs font-black tracking-wide mb-2">
            <Sparkles className="w-3.5 h-3.5 text-stroom-orange" />
            <span>STROOM VIBE QUIZ ENGINE CMS</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-stroom-black font-display">
            Onboarding Quiz & Vibe Taxonomy
          </h1>
          <p className="text-xs sm:text-sm text-stroom-charcoal/80 mt-1">
            Configure dynamic questions, interest tags, versioning, and preview real-time flows.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`py-2.5 px-4 rounded-xl border text-xs font-black flex items-center gap-2 transition-all ${
              previewMode
                ? 'bg-stroom-orange border-stroom-orange text-white shadow-brand'
                : 'bg-white border-stroom-borderLight text-stroom-black hover:bg-stroom-cream'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>{previewMode ? 'Exit Mobile Preview' : 'Interactive Mobile Preview'}</span>
          </button>

          {isDraft && (
            <button
              onClick={() => setShowPublishModal(true)}
              className="py-2.5 px-5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white text-xs font-black flex items-center gap-2 shadow-brand hover:brightness-105 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Publish Version {activeVersion?.version_number}</span>
            </button>
          )}

          {!isDraft && (
            <button
              onClick={handleCreateDraft}
              className="py-2.5 px-4 rounded-xl bg-stroom-cream hover:bg-stroom-orange hover:text-white border border-stroom-orange/30 text-stroom-black text-xs font-black flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>Create Draft Version</span>
            </button>
          )}
        </div>
      </div>

      {/* Status Alert Banner */}
      {statusMessage && (
        <div
          className={`mb-6 p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-2 animate-fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-rose-50 border-rose-300 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)}>
            <X className="w-4 h-4 hover:opacity-70" />
          </button>
        </div>
      )}

      {/* Metrics Row */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-2xl bg-white border border-stroom-borderLight shadow-xs">
            <div className="flex items-center justify-between text-stroom-charcoal/70 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Total Sessions</span>
              <BarChart3 className="w-4 h-4 text-stroom-orange" />
            </div>
            <p className="text-2xl font-black text-stroom-black font-display">{overview.stats.total_sessions}</p>
            <p className="text-[11px] text-stroom-charcoal/60 mt-1">{overview.stats.total_users} registered users</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-stroom-borderLight shadow-xs">
            <div className="flex items-center justify-between text-stroom-charcoal/70 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Completed</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-2xl font-black text-emerald-600 font-display">{overview.stats.completed_sessions}</p>
            <p className="text-[11px] text-stroom-charcoal/60 mt-1">{overview.stats.completion_rate}% completion rate</p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-stroom-borderLight shadow-xs">
            <div className="flex items-center justify-between text-stroom-charcoal/70 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Published Ver.</span>
              <Layers className="w-4 h-4 text-stroom-orange" />
            </div>
            <p className="text-2xl font-black text-stroom-black font-display">
              {overview.published_version ? `v${overview.published_version.version_number}` : 'None'}
            </p>
            <p className="text-[11px] text-stroom-charcoal/60 mt-1">
              {overview.published_version?.question_count || 0} active questions
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-stroom-borderLight shadow-xs">
            <div className="flex items-center justify-between text-stroom-charcoal/70 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Draft Status</span>
              <Sparkles className="w-4 h-4 text-stroom-gold" />
            </div>
            <p className="text-2xl font-black text-stroom-deep font-display">
              {overview.draft_version ? `v${overview.draft_version.version_number} (Draft)` : 'No Draft'}
            </p>
            <p className="text-[11px] text-stroom-charcoal/60 mt-1">
              {overview.draft_version ? 'Ready to edit' : 'Current version live'}
            </p>
          </div>
        </div>
      )}

      {/* Main CMS Layout */}
      <div className={`grid gap-8 ${previewMode ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        
        {/* Left Side: Version Selector & Questions Editor */}
        <div className={previewMode ? 'lg:col-span-7' : 'w-full'}>
          {/* Version Switcher Tabs */}
          <div className="bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-xs mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-stroom-cream">
              <div>
                <h3 className="text-sm font-black text-stroom-black uppercase tracking-wider">
                  Version History & Release Management
                </h3>
                <p className="text-xs text-stroom-charcoal/70 mt-0.5">
                  Select a version to inspect questions or modify the active draft.
                </p>
              </div>

              {/* Version Pills */}
              <div className="flex flex-wrap items-center gap-2">
                {quizzes[0]?.versions?.map((ver: any) => {
                  const isSelected = selectedVersionId === ver.id;
                  return (
                    <button
                      key={ver.id}
                      onClick={() => handleSelectVersion(ver.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? ver.publication_status === 'draft'
                            ? 'bg-stroom-deep text-white shadow-brand'
                            : 'bg-stroom-orange text-white shadow-brand'
                          : ver.publication_status === 'draft'
                          ? 'bg-stroom-cream text-stroom-deep border border-stroom-orange/30'
                          : 'bg-stone-100 text-stroom-charcoal hover:bg-stroom-cream'
                      }`}
                    >
                      <span>v{ver.version_number}</span>
                      <span className="text-[10px] uppercase opacity-85">
                        ({ver.publication_status})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Version Metadata Details */}
            {activeVersion && (
              <div className="pt-4 flex flex-wrap items-center justify-between gap-4 text-xs font-semibold text-stroom-charcoal">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                      activeVersion.publication_status === 'published'
                        ? 'bg-emerald-100 text-emerald-800'
                        : activeVersion.publication_status === 'draft'
                        ? 'bg-stroom-cream text-stroom-deep border border-stroom-orange/30'
                        : 'bg-stone-200 text-stone-700'
                    }`}
                  >
                    Status: {activeVersion.publication_status}
                  </span>
                  <span>Version #{activeVersion.version_number}</span>
                  <span>•</span>
                  <span>Created by {activeVersion.created_by || 'Admin'}</span>
                </div>

                {isDraft && (
                  <button
                    onClick={handleOpenAddQuestion}
                    className="px-4 py-2 rounded-xl bg-stroom-orange hover:bg-stroom-deep text-white text-xs font-black shadow-brand flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Question to Draft</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Question List */}
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-3 border-stroom-orange border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs font-bold text-stroom-charcoal">Loading quiz configuration...</p>
            </div>
          ) : !activeVersion || !activeVersion.questions || activeVersion.questions.length === 0 ? (
            <div className="p-12 text-center rounded-3xl bg-white border border-stroom-borderLight">
              <HelpCircle className="w-12 h-12 text-stone-300 mx-auto mb-3" />
              <h4 className="text-base font-black text-stroom-black">No questions in this version</h4>
              <p className="text-xs text-stroom-charcoal/70 mt-1 max-w-sm mx-auto">
                {isDraft
                  ? 'Get started by creating the first question for this onboarding quiz.'
                  : 'This version has no questions configured.'}
              </p>
              {isDraft && (
                <button
                  onClick={handleOpenAddQuestion}
                  className="mt-4 px-4 py-2 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand"
                >
                  Create First Question
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {activeVersion.questions.map((q, idx) => (
                <div
                  key={q.id}
                  className="bg-white rounded-3xl p-5 border border-stroom-borderLight shadow-xs hover:border-stroom-orange/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="w-8 h-8 rounded-xl bg-stroom-cream text-stroom-deep font-black text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-stroom-cream text-stroom-deep">
                            {q.question_type === 'single' ? 'Single Choice' : `Multiple (Max ${q.max_selections})`}
                          </span>
                          {q.is_required ? (
                            <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                              Required
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-full">
                              Optional
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-stroom-black leading-snug">
                          {q.question_text}
                        </h4>
                        {q.description && (
                          <p className="text-xs text-stroom-charcoal/70 mt-0.5">
                            {q.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions for Question */}
                    {isDraft && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveQuestion(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-30 text-stone-600"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveQuestion(idx, 'down')}
                          disabled={idx === (activeVersion.questions?.length ?? 0) - 1}
                          className="p-1.5 rounded-lg hover:bg-stone-100 disabled:opacity-30 text-stone-600"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          className="p-1.5 rounded-lg hover:bg-stroom-cream text-stroom-deep"
                          title="Edit question"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-600"
                          title="Delete question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="mt-4 pt-3 border-t border-stroom-cream">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-stroom-charcoal/70">
                        Response Options ({q.options?.length || 0})
                      </span>
                      {isDraft && (
                        <button
                          onClick={() => handleOpenAddOption(q.id)}
                          className="text-[11px] font-black text-stroom-orange hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Option</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options?.map((opt) => (
                        <div
                          key={opt.id}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-stroom-ivory border border-stroom-borderLight text-xs font-semibold"
                        >
                          <div className="truncate mr-2">
                            <span className="text-stroom-black">{opt.label}</span>
                            <span className="text-[10px] text-stroom-charcoal/50 block truncate font-mono">
                              #{opt.stable_value}
                            </span>
                          </div>
                          {isDraft && (
                            <button
                              onClick={() => handleDeleteOption(opt.id)}
                              className="text-stone-400 hover:text-rose-600 p-1 shrink-0"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Interactive Mobile Preview Bezel */}
        {previewMode && (
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="sticky top-24 w-full max-w-sm">
              <div className="bg-stroom-black rounded-[42px] p-3 shadow-2xl border-4 border-stroom-charcoal relative">
                {/* Speaker pill */}
                <div className="w-24 h-4 bg-stroom-cardDark rounded-full mx-auto mb-2" />

                {/* Device Screen */}
                <div className="bg-stroom-ivory rounded-[34px] p-5 min-h-[580px] flex flex-col justify-between overflow-hidden relative">
                  {activeVersion?.questions && activeVersion.questions.length > 0 ? (
                    <div>
                      {/* Mini Progress Bar */}
                      <div className="flex items-center justify-between text-[10px] font-black text-stroom-charcoal mb-2">
                        <span>QUESTION {previewIndex + 1} OF {activeVersion.questions.length}</span>
                        <span>{Math.round(((previewIndex + 1) / activeVersion.questions.length) * 100)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-stroom-cream rounded-full overflow-hidden mb-6">
                        <div
                          className="h-full bg-stroom-orange transition-all duration-300"
                          style={{
                            width: `${((previewIndex + 1) / activeVersion.questions.length) * 100}%`,
                          }}
                        />
                      </div>

                      {/* Current Preview Question */}
                      {(() => {
                        const curQ = activeVersion.questions[previewIndex];
                        if (!curQ) return null;
                        const isSingle = curQ.question_type === 'single';
                        const selectedAnswers = previewAnswers[curQ.id] || [];

                        return (
                          <div>
                            <h3 className="text-base font-black text-stroom-black leading-snug">
                              {curQ.question_text}
                            </h3>
                            {curQ.description && (
                              <p className="text-xs text-stroom-charcoal/70 mt-1 mb-4">
                                {curQ.description}
                              </p>
                            )}

                            {/* Options */}
                            <div className="space-y-2 mt-4 max-h-[340px] overflow-y-auto pr-1">
                              {curQ.options?.map((opt) => {
                                const isChecked = selectedAnswers.includes(opt.id);
                                return (
                                  <div
                                    key={opt.id}
                                    onClick={() => handlePreviewToggleOption(curQ.id, opt.id, isSingle)}
                                    className={`p-3 rounded-2xl border text-xs font-extrabold cursor-pointer transition-all flex items-center justify-between ${
                                      isChecked
                                        ? 'bg-stroom-orange text-white border-stroom-orange shadow-brand'
                                        : 'bg-white text-stroom-black border-stroom-borderLight hover:bg-stroom-cream'
                                    }`}
                                  >
                                    <span>{opt.label}</span>
                                    {isChecked && <Check className="w-4 h-4" />}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="py-20 text-center">
                      <p className="text-xs font-bold text-stroom-charcoal">No questions to preview</p>
                    </div>
                  )}

                  {/* Device Bottom Controls */}
                  <div className="pt-4 border-t border-stroom-cream flex items-center justify-between">
                    <button
                      onClick={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                      disabled={previewIndex === 0}
                      className="px-3 py-1.5 rounded-xl bg-white border border-stroom-borderLight text-xs font-bold disabled:opacity-40"
                    >
                      Back
                    </button>
                    <button
                      onClick={() =>
                        setPreviewIndex((prev) =>
                          Math.min((activeVersion?.questions?.length || 1) - 1, prev + 1)
                        )
                      }
                      disabled={previewIndex >= (activeVersion?.questions?.length || 1) - 1}
                      className="px-4 py-1.5 rounded-xl bg-stroom-orange text-white text-xs font-black shadow-brand disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>

                {/* Home Indicator line */}
                <div className="w-32 h-1 bg-stone-600 rounded-full mx-auto mt-2.5" />
              </div>
              <p className="text-[11px] font-bold text-stroom-charcoal/70 text-center mt-3">
                Live Interactive Simulation (Version {activeVersion?.version_number})
              </p>
            </div>
          </div>
        )}

      </div>

      {/* Add / Edit Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl relative">
            <h3 className="text-base font-black text-stroom-black font-display">
              {isNewQuestion ? 'Add Question to Draft' : 'Edit Question'}
            </h3>

            <form onSubmit={handleSaveQuestion} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Question Text
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Which IPL squad would you franchise first?"
                  value={questionFormData.question_text}
                  onChange={(e) =>
                    setQuestionFormData({ ...questionFormData, question_text: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Description / Helper Note
                </label>
                <input
                  type="text"
                  placeholder="e.g. Select the team vibe you resonate with most"
                  value={questionFormData.description}
                  onChange={(e) =>
                    setQuestionFormData({ ...questionFormData, description: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Choice Type
                  </label>
                  <select
                    value={questionFormData.question_type}
                    onChange={(e) =>
                      setQuestionFormData({ ...questionFormData, question_type: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight text-xs font-semibold outline-none"
                  >
                    <option value="single">Single Choice</option>
                    <option value="multiple">Multiple Choice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                    Requirement
                  </label>
                  <select
                    value={questionFormData.is_required}
                    onChange={(e) =>
                      setQuestionFormData({ ...questionFormData, is_required: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-stroom-borderLight text-xs font-semibold outline-none"
                  >
                    <option value={1}>Required</option>
                    <option value={0}>Optional</option>
                  </select>
                </div>
              </div>

              {questionFormData.question_type === 'multiple' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                      Min Selections
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={questionFormData.min_selections}
                      onChange={(e) =>
                        setQuestionFormData({
                          ...questionFormData,
                          min_selections: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 rounded-xl border border-stroom-borderLight text-xs font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                      Max Selections
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={questionFormData.max_selections}
                      onChange={(e) =>
                        setQuestionFormData({
                          ...questionFormData,
                          max_selections: Number(e.target.value),
                        })
                      }
                      className="w-full px-4 py-2 rounded-xl border border-stroom-borderLight text-xs font-semibold outline-none"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105"
                >
                  Save Question
                </button>
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Option Modal */}
      {editingOptionQuestionId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-stroom-borderLight shadow-2xl relative">
            <h3 className="text-base font-black text-stroom-black font-display">
              Add Response Option
            </h3>

            <form onSubmit={handleSaveOption} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Option Label
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Hyderabad Deccan Chargers"
                  value={optionFormData.label}
                  onChange={(e) =>
                    setOptionFormData({ ...optionFormData, label: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-stroom-borderLight focus:border-stroom-orange text-xs font-semibold outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stroom-charcoal uppercase tracking-wider mb-1">
                  Vibe Tag / Stable Value (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. hyderabad_chargers"
                  value={optionFormData.stable_value}
                  onChange={(e) =>
                    setOptionFormData({ ...optionFormData, stable_value: e.target.value })
                  }
                  className="w-full px-4 py-2.5 rounded-xl border border-stroom-borderLight focus:border-stroom-orange text-xs font-mono text-xs outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-stroom-orange text-white font-black text-xs shadow-brand hover:brightness-105"
                >
                  Add Option
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOptionQuestionId(null)}
                  className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Version Confirmation Modal */}
      {showPublishModal && activeVersion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stroom-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-stroom-orange/30 shadow-2xl relative">
            <div className="w-12 h-12 rounded-2xl bg-stroom-cream text-stroom-deep flex items-center justify-center mb-3">
              <Send className="w-6 h-6 text-stroom-orange" />
            </div>
            <h3 className="text-lg font-black text-stroom-black font-display">
              Publish Quiz Version {activeVersion.version_number}?
            </h3>
            <p className="text-xs text-stroom-charcoal/80 mt-2 leading-relaxed">
              Publishing will make this version the active onboarding quiz for all incoming members.
              The previous published version will be safely archived. This draft will become immutable.
            </p>

            <div className="mt-4 p-3 rounded-2xl bg-stroom-ivory border border-stroom-borderLight text-xs space-y-1 font-semibold text-stroom-charcoal">
              <div className="flex items-center justify-between">
                <span>Active Questions:</span>
                <span className="font-black text-stroom-black">{activeVersion.questions?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created by:</span>
                <span className="font-black text-stroom-black">{activeVersion.created_by || 'Admin'}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <button
                type="button"
                disabled={isPublishing}
                onClick={handlePublish}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-stroom-orange to-stroom-deep text-white font-black text-xs shadow-brand hover:brightness-105 disabled:opacity-50"
              >
                {isPublishing ? 'Publishing...' : 'Confirm & Publish Live'}
              </button>
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                className="px-4 py-2.5 rounded-xl bg-stone-100 text-stone-700 font-bold text-xs"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
