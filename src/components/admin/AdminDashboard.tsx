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
  Check
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
      setQuizzes(quizzesData.quizzes);

      // Default select draft version if available, otherwise published version
      const defaultVerId =
        overviewData.draft_version?.id ||
        overviewData.published_version?.id ||
        quizzesData.quizzes[0]?.versions[0]?.id;

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
      handleSelectVersion(res.draft_version_id);
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
    <div className="max-w-7xl mx-auto px-4 py-6 pb-28 animate-fade-in text-left">
      {/* Top Admin Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-bold tracking-wide mb-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>STROOM ADMINISTRATION CMS</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white">Vibe Quiz Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure questions, response options, versioning, and preview dynamic quiz flows.
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`py-2.5 px-4 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all ${
              previewMode
                ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>{previewMode ? 'Exit Mobile Preview' : 'Interactive Mobile Preview'}</span>
          </button>

          {isDraft && (
            <button
              onClick={() => setShowPublishModal(true)}
              className="py-2.5 px-5 rounded-xl vibe-gradient-bg text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/30 hover:brightness-110 active:scale-95 transition-all"
            >
              <Send className="w-4 h-4" />
              <span>Publish Version {activeVersion?.version_number}</span>
            </button>
          )}

          {!isDraft && (
            <button
              onClick={handleCreateDraft}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-bold flex items-center gap-2 transition-all"
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
          className={`mb-6 p-4 rounded-2xl border text-xs flex items-center justify-between gap-2 animate-fade-in ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
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
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Total Sessions</span>
              <BarChart3 className="w-4 h-4 text-indigo-400" />
            </div>
            <p className="text-2xl font-black text-white">{overview.stats.total_sessions}</p>
            <p className="text-[11px] text-slate-500 mt-1">{overview.stats.total_users} registered users</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Completion Rate</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-black text-emerald-400">{overview.stats.completion_rate}%</p>
            <p className="text-[11px] text-slate-500 mt-1">{overview.stats.completed_sessions} completed quizzes</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Skip Rate</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-400">{overview.stats.skip_rate}%</p>
            <p className="text-[11px] text-slate-500 mt-1">{overview.stats.skipped_sessions} skipped sessions</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 shadow-md">
            <div className="flex items-center justify-between text-slate-400 mb-1">
              <span className="text-xs font-semibold">Active Version</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <p className="text-2xl font-black text-white">v{overview.published_version?.version_number || 1}</p>
            <p className="text-[11px] text-purple-400 mt-1">
              {overview.draft_version ? `Draft v${overview.draft_version.version_number} in progress` : 'All versions published'}
            </p>
          </div>
        </div>
      )}

      {/* Main Content: Split Screen or Single Column */}
      <div className={`grid gap-8 ${previewMode ? 'grid-cols-1 lg:grid-cols-12' : 'grid-cols-1'}`}>
        {/* Left Column: Management CMS */}
        <div className={previewMode ? 'lg:col-span-7 space-y-6' : 'space-y-6'}>
          {/* Version Selector Tabs */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-wrap items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-2">Version:</span>
              {quizzes[0]?.versions?.map((ver: any) => (
                <button
                  key={ver.id}
                  onClick={() => handleSelectVersion(ver.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                    selectedVersionId === ver.id
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span>v{ver.version_number}</span>
                  <span
                    className={`text-[9px] uppercase px-1.5 py-0.2 rounded-md ${
                      ver.publication_status === 'published'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : ver.publication_status === 'draft'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {ver.publication_status}
                  </span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              {isDraft ? (
                <button
                  onClick={handleOpenAddQuestion}
                  className="py-1.5 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Question</span>
                </button>
              ) : (
                <span className="text-xs text-slate-500 italic">
                  Published versions are immutable. Create a draft to edit.
                </span>
              )}
            </div>
          </div>

          {/* Questions List */}
          {isLoading ? (
            <div className="py-20 text-center">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-xs text-slate-400">Loading version questions...</p>
            </div>
          ) : !activeVersion || !activeVersion.questions || activeVersion.questions.length === 0 ? (
            <div className="py-16 text-center rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
              <p className="text-sm font-semibold text-slate-300">No questions in this version</p>
              {isDraft && (
                <button
                  onClick={handleOpenAddQuestion}
                  className="mt-3 py-2 px-4 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                >
                  Add your first question
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {activeVersion.questions.map((q, qIndex) => (
                <div
                  key={q.id}
                  className={`rounded-3xl border p-5 transition-all shadow-lg ${
                    q.is_active ? 'bg-slate-900/80 border-white/10' : 'bg-slate-950/60 border-slate-800 opacity-60'
                  }`}
                >
                  {/* Question Header & Controls */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                        {qIndex + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{q.question_text}</h3>
                          <span
                            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                              q.question_type === 'single'
                                ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                                : 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                            }`}
                          >
                            {q.question_type === 'single' ? 'Single' : `Multi (Max ${q.max_selections})`}
                          </span>
                          {q.is_required ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                              Required
                            </span>
                          ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                              Optional
                            </span>
                          )}
                        </div>
                        {q.description && (
                          <p className="text-xs text-slate-400 mt-1">{q.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Action buttons (only if draft) */}
                    {isDraft && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleMoveQuestion(qIndex, 'up')}
                          disabled={qIndex === 0}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                          title="Move Up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleMoveQuestion(qIndex, 'down')}
                          disabled={qIndex === activeVersion.questions!.length - 1}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30"
                          title="Move Down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenEditQuestion(q)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300"
                          title="Edit Question"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-rose-400"
                          title="Delete Question"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Options List */}
                  <div className="mt-3 pt-3 border-t border-slate-800/80">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        Options ({q.options.length})
                      </span>
                      {isDraft && (
                        <button
                          onClick={() => handleOpenAddOption(q.id)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add Option</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt) => (
                        <div
                          key={opt.id}
                          className="p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-200 truncate">{opt.label}</p>
                            <p className="text-[10px] text-slate-500 font-mono">#{opt.stable_value}</p>
                          </div>
                          {isDraft && (
                            <button
                              onClick={() => handleDeleteOption(opt.id)}
                              className="text-slate-500 hover:text-rose-400 p-1 transition-colors"
                              title="Delete option"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

        {/* Right Column: Live Smartphone Preview (Interactive!) */}
        {previewMode && activeVersion?.questions && (
          <div className="lg:col-span-5 sticky top-6">
            <div className="w-full max-w-sm mx-auto p-4 rounded-[42px] bg-slate-900 border-4 border-slate-800 shadow-2xl relative">
              {/* Smartphone Camera Notch */}
              <div className="w-32 h-4 bg-slate-950 rounded-full mx-auto mb-4 border border-white/5" />

              <div className="bg-slate-950 rounded-[32px] p-4 min-h-[580px] flex flex-col justify-between border border-white/5 overflow-hidden">
                {activeVersion.questions.length === 0 ? (
                  <div className="py-24 text-center text-xs text-slate-500">
                    Add questions to preview quiz flow.
                  </div>
                ) : (
                  <>
                    <div>
                      {/* Interactive Progress */}
                      <QuizProgress
                        currentStep={previewIndex}
                        totalSteps={activeVersion.questions.length}
                        onSkip={() => alert('Skip triggered in mobile preview')}
                      />

                      {/* Interactive Question */}
                      {activeVersion.questions[previewIndex] && (
                        <>
                          <QuizQuestionComp question={activeVersion.questions[previewIndex]} />

                          {/* Options */}
                          <div className="space-y-2 mt-3">
                            {activeVersion.questions[previewIndex].options.map((opt) => {
                              const qId = activeVersion.questions![previewIndex].id;
                              const isSingle = activeVersion.questions![previewIndex].question_type === 'single';
                              const isSelected = (previewAnswers[qId] || []).includes(opt.id);

                              return (
                                <QuizOptionCard
                                  key={opt.id}
                                  option={opt}
                                  isSelected={isSelected}
                                  onSelect={() => handlePreviewToggleOption(qId, opt.id, isSingle)}
                                />
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Preview Navigation */}
                    <QuizNavigation
                      onBack={() => setPreviewIndex((prev) => Math.max(0, prev - 1))}
                      onNext={() => {
                        if (previewIndex < activeVersion.questions!.length - 1) {
                          setPreviewIndex((prev) => prev + 1);
                        } else {
                          alert('Quiz completed in mobile preview! Preferences will be mapped.');
                          setPreviewIndex(0);
                        }
                      }}
                      canGoBack={previewIndex > 0}
                      isLastQuestion={previewIndex === activeVersion.questions.length - 1}
                      isValid={true}
                    />
                  </>
                )}
              </div>
            </div>
            <p className="text-center text-xs text-slate-500 mt-3">
              Interactive Live Preview of Version {activeVersion.version_number}
            </p>
          </div>
        )}
      </div>

      {/* Edit/Add Question Modal */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">
                {isNewQuestion ? 'Add Question to Draft' : 'Edit Question'}
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Question Text</label>
                <input
                  type="text"
                  required
                  value={questionFormData.question_text}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, question_text: e.target.value })}
                  placeholder="e.g. What's your focus right now?"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  value={questionFormData.description}
                  onChange={(e) => setQuestionFormData({ ...questionFormData, description: e.target.value })}
                  placeholder="e.g. Select up to 3 options."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Question Type</label>
                  <select
                    value={questionFormData.question_type}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, question_type: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value="single">Single Choice</option>
                    <option value="multiple">Multiple Choice</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Requirement</label>
                  <select
                    value={questionFormData.is_required}
                    onChange={(e) => setQuestionFormData({ ...questionFormData, is_required: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                  >
                    <option value={1}>Required</option>
                    <option value={0}>Optional</option>
                  </select>
                </div>
              </div>

              {questionFormData.question_type === 'multiple' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Min Selections</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={questionFormData.min_selections}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, min_selections: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Max Selections</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={questionFormData.max_selections}
                      onChange={(e) => setQuestionFormData({ ...questionFormData, max_selections: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Option Modal */}
      {editingOptionQuestionId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Add Option</h3>
              <button
                onClick={() => setEditingOptionQuestionId(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOption} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Option Display Label</label>
                <input
                  type="text"
                  required
                  value={optionFormData.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    const autoStable = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 40);
                    setOptionFormData({ label, stable_value: autoStable });
                  }}
                  placeholder="e.g. Travel and adventures"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Stable Value (Preference Tag Key)
                </label>
                <input
                  type="text"
                  required
                  value={optionFormData.stable_value}
                  onChange={(e) => setOptionFormData({ ...optionFormData, stable_value: e.target.value })}
                  placeholder="e.g. travel_adventure"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white font-mono"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Used to map user preferences and filter personalized discovery feeds.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingOptionQuestionId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  Add Option
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Publish Confirmation Modal */}
      {showPublishModal && activeVersion && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl animate-slide-up text-left">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <Send className="w-6 h-6" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">
              Publish Quiz Version {activeVersion.version_number}?
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              Publishing will make this version immediately active for all new onboarding users. Existing user sessions and historical responses will remain preserved against their previous versions.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs space-y-1.5 mb-5">
              <div className="flex items-center justify-between text-slate-400">
                <span>Active Questions:</span>
                <span className="font-bold text-white">{activeVersion.questions?.length || 0}</span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Total Options:</span>
                <span className="font-bold text-white">
                  {activeVersion.questions?.reduce((acc, q) => acc + q.options.length, 0) || 0}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-400">
                <span>Versioning:</span>
                <span className="font-bold text-emerald-400">Immutable Snapshot</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowPublishModal(false)}
                disabled={isPublishing}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className="px-5 py-2.5 rounded-xl vibe-gradient-bg text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-500/25"
              >
                {isPublishing ? (
                  <span>Publishing...</span>
                ) : (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Confirm & Publish</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
