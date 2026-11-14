"use client";

import { useEffect, useMemo, useState } from "react";
import { buildReview, createEmptyAnswers, questions, type Participant, type Session } from "@/lib/game";

const DB_SESSION_PREFIX = "church-game-session-v1";

async function saveSessionToServer(session: Session) {
  try {
    const payload = JSON.stringify(session);
    await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.sessionId, payload }),
    });
  } catch (error) {
    console.error("saveSessionToServer failed", error);
  }
}

async function loadSessionFromServer(sessionId: string): Promise<Session | null> {
  try {
    const response = await fetch(`/api/sessions?sessionId=${encodeURIComponent(sessionId)}`);
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data?.session) {
      return null;
    }

    return JSON.parse(data.session) as Session;
  } catch (error) {
    console.error("loadSessionFromServer failed", error);
    return null;
  }
}

function getSessionKey(sessionId: string) {
  return `${DB_SESSION_PREFIX}:${sessionId}`;
}

function loadSession(sessionId: string): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(getSessionKey(sessionId));
  return raw ? (JSON.parse(raw) as Session) : null;
}

function saveSession(session: Session) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(getSessionKey(session.sessionId), JSON.stringify(session));
}

function buildSessionId() {
  return `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function getShareOrigin() {
  if (typeof window === "undefined") return "";

  const { origin, hostname, protocol, port } = window.location;

  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "0.0.0.0") {
    return `http://10.170.10.134:3001`;
  }

  return origin || `${protocol}//${hostname}${port ? `:${port}` : ""}`;
}

function buildShareUrl(sessionId: string, session?: Session) {
  if (typeof window === "undefined") return "";

  const base = new URL(getShareOrigin());
  const url = new URL(base.origin + "/");
  url.searchParams.set("sessionId", sessionId);
  url.searchParams.delete("sessionData");
  return url.toString();
}

function serializeSession(session: Session) {
  try {
    const sharePayload = {
      sessionId: session.sessionId,
      initiatorName: session.initiatorName,
      currentQuestionIndex: session.currentQuestionIndex,
      participants: session.participants,
      hasStarted: !!session.hasStarted,
    };
    return btoa(encodeURIComponent(JSON.stringify(sharePayload)));
  } catch {
    return "";
  }
}

function deserializeSession(raw: string | null): Session | null {
  if (!raw) return null;

  try {
    const decoded = decodeURIComponent(atob(raw));
    const parsed = JSON.parse(decoded) as Partial<Session>;
    if (!parsed.sessionId) return null;

    return {
      sessionId: parsed.sessionId,
      initiatorName: parsed.initiatorName || "發起人",
      initiatorAnswers: createEmptyAnswers(),
      participants: parsed.participants || [],
      currentQuestionIndex: parsed.currentQuestionIndex ?? 0,
      hasStarted: !!parsed.hasStarted,
    };
  } catch {
    return null;
  }
}

function getSessionFromUrl(): Session | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const payload = params.get("sessionData");
  if (!payload) return null;

  return deserializeSession(payload);
}

function buildRoundReviewData(session: Session | null) {
  if (!session) return [];

  return session.participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    answer: participant.answers[session.currentQuestionIndex] ?? "",
  }));
}

function allParticipantsAnsweredCurrentQuestion(session: Session | null, questionIndexOverride?: number) {
  if (!session) return false;
  const idx = questionIndexOverride ?? session.currentQuestionIndex ?? 0;
  if (session.participants.length === 0) return false;
  return session.participants.every((participant) => (participant.answers[idx] ?? "").trim() !== "");
}

function ParticipantCard({
  participant,
  onEditName,
}: {
  participant: Participant;
  onEditName: (id: string, name: string) => void;
}) {
  const [name, setName] = useState(participant.name);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-500">暱稱</span>
        <button
          type="button"
          onClick={() => onEditName(participant.id, name)}
          className="rounded-full bg-sky-600 px-3 py-1 text-xs font-medium text-white"
        >
          更新
        </button>
      </div>
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-0 focus:border-sky-500"
        placeholder="輸入暱稱"
      />
      <div className="mt-3 text-xs text-slate-500">
        狀態：{participant.completed ? "已完成" : "尚未完成"}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [view, setView] = useState<"home" | "initiator" | "participant" | "results">("home");
  const [selectedRole, setSelectedRole] = useState<"initiator" | "participant" | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [nicknameInput, setNicknameInput] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [initiatorName, setInitiatorName] = useState("發起人");
  const [showAnswers, setShowAnswers] = useState(false);
  const [alert, setAlert] = useState("");

  const roleSelectScreen = () => (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_45%,_#eef2ff_100%)] px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 rounded-3xl border border-sky-100 bg-white/80 p-8 shadow-xl backdrop-blur-sm">
          <p className="text-sm font-medium uppercase tracking-[0.26em] text-sky-700">團契互動遊戲</p>
          <h1 className="mt-4 text-4xl font-black text-slate-900">磐石自介</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            請先選擇你的身份，發起人可建立遊戲並控制開始，玩家則直接加入並開始作答。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setSelectedRole("initiator");
              setView("initiator");
            }}
            className="rounded-3xl bg-sky-600 p-6 text-left text-white shadow-lg transition hover:bg-sky-700"
          >
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-sky-100">發起人</div>
            <div className="mt-4 text-2xl font-bold">建立遊戲</div>
            <p className="mt-3 text-sm text-sky-100">輸入暱稱、填寫自己的答案，並按開始讓所有人一起作答。</p>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedRole("participant");
              setView("participant");
            }}
            className="rounded-3xl bg-violet-600 p-6 text-left text-white shadow-lg transition hover:bg-violet-700"
          >
            <div className="text-sm font-medium uppercase tracking-[0.2em] text-violet-100">玩家</div>
            <div className="mt-4 text-2xl font-bold">加入作答</div>
            <p className="mt-3 text-sm text-violet-100">輸入自訂暱稱，加入發起人分享的連結後開始作答。</p>
          </button>
        </div>
      </div>
    </main>
  );

  const revealParticipantsAnswers = () => {
    if (!session) return false;
    return session.participants.length > 0 && session.participants.every((p) => (p.answers[session.currentQuestionIndex ?? 0] ?? "").trim() !== "");
  };

  const leaderBoard = useMemo(() => {
    if (!session) return [];

    return session.participants
      .map((participant) => {
        const reviews = buildReview(session.initiatorAnswers, participant.answers);
        const correctCount = reviews.filter((item) => item.correct).length;
        return {
          ...participant,
          correctCount,
          reviews,
        };
      })
      .sort((a, b) => b.correctCount - a.correctCount);
  }, [session]);

  const currentResults = useMemo(() => {
    if (!session) return [];
    const targetId = selectedParticipantId || participantId || session.participants[0]?.id || "";
    const target = session.participants.find((item) => item.id === targetId);
    if (!target) return [];
    return buildReview(session.initiatorAnswers, target.answers);
  }, [participantId, selectedParticipantId, session]);

  const currentTarget = useMemo(() => {
    if (!session) return null;
    const targetId = selectedParticipantId || participantId || session.participants[0]?.id || "";
    return session.participants.find((item) => item.id === targetId) || null;
  }, [participantId, selectedParticipantId, session]);

  useEffect(() => {
    if (!session) return;
    saveSession(session);
    saveSessionToServer(session);
  }, [session]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get("sessionId");

    if (sid) {
      const sessionFromUrl = getSessionFromUrl();
      const currentSession = sessionFromUrl && sessionFromUrl.sessionId === sid ? sessionFromUrl : null;

      if (currentSession) {
        setSession(currentSession);
        setView("participant");
        setAlert("已開啟分享連結，請輸入暱稱以加入作答。");
        return;
      }

      (async () => {
        const remoteSession = await loadSessionFromServer(sid);
        if (remoteSession) {
          setSession(remoteSession);
          setView("participant");
          setAlert("已開啟分享連結，請輸入暱稱以加入作答。");
          return;
        }

        const localSession = loadSession(sid);
        if (localSession) {
          setSession(localSession);
          setView("participant");
          setAlert("已開啟分享連結，請輸入暱稱以加入作答。");
          return;
        }

        setView("home");
        setAlert("已開啟分享連結，但此裝置尚未同步到這個遊戲。請讓發起人先建立連結，或使用雲端同步方案。 ");
      })();
      return;
    }

    const existing = window.localStorage.getItem("church-game-current-session");
    if (!existing) return;

    const currentSession = loadSession(existing);
    if (!currentSession) return;

    setSession(currentSession);
    setView("home");
  }, []);

  const createSession = () => {
    const nextSession: Session = {
      sessionId: buildSessionId(),
      initiatorName: initiatorName || "發起人",
      initiatorAnswers: createEmptyAnswers(),
      currentQuestionIndex: 0,
      participants: [],
      hasStarted: false,
    };

    setSession(nextSession);
    window.localStorage.setItem("church-game-current-session", nextSession.sessionId);
    saveSessionToServer(nextSession);
    try {
      window.history.replaceState(null, "", buildShareUrl(nextSession.sessionId, nextSession));
    } catch (e) {
      // ignore
    }
    setView("home");
  };

  const startQuestionRound = () => {
    if (!session) return;

    const nextSession: Session = {
      ...session,
      hasStarted: true,
      currentQuestionIndex: 0,
    };

    setSession(nextSession);
    saveSession(nextSession);
    setShowAnswers(false);
    setAlert("已開始問答，請讓所有玩家開始作答。 ");
  };

  const advanceToNextQuestion = () => {
    if (!session) return;
    const nextIndex = (session.currentQuestionIndex ?? 0) + 1;
    if (nextIndex >= questions.length) {
      const finished = { ...session, currentQuestionIndex: questions.length - 1 };
      setSession(finished);
      saveSession(finished);
      setView("results");
      setShowAnswers(false);
      return;
    }

    const nextSession = { ...session, currentQuestionIndex: nextIndex, hasStarted: true };
    setSession(nextSession);
    saveSession(nextSession);
    setShowAnswers(false);
    setAlert("所有人已作答，現在進入下一題。 ");
  };

  const revealRoundAnswers = () => {
    if (!session) return;
    setShowAnswers(true);
    setAlert("所有玩家已完成作答，現在可一起觀看答案。 ");
  };

  const allAnsweredCurrent = () => {
    if (!session) return false;
    const idx = session.currentQuestionIndex ?? 0;
    return session.participants.length > 0 && session.participants.every((p) => (p.answers[idx] ?? "").trim() !== "");
  };

  const openResults = () => {
    if (!session) return;
    if (!getAllParticipantsCompleted()) {
      setAlert("請等所有參與者都完成作答後再查看成績。 ");
      return;
    }
    setView("results");
    setSelectedParticipantId(session.participants[0]?.id ?? "");
    setAlert("");
  };

  const updateSessionForParticipant = (nextSession: Session) => {
    setSession(nextSession);
    saveSession(nextSession);
    window.localStorage.setItem("church-game-current-session", nextSession.sessionId);
  };

  const copyShareLink = async () => {
    if (!session) return;

    const shareUrl = buildShareUrl(session.sessionId, session);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setAlert("分享連結已複製，直接傳給玩家即可。");
    } catch {
      setAlert("複製失敗，請手動複製下方連結。 ");
    }
  };

  const joinParticipantFromLink = () => {
    if (!session) return;
    if (!nicknameInput.trim()) {
      setAlert("請輸入暱稱。 ");
      return;
    }

    const nextId = `participant-${Date.now().toString(36)}`;
    const nextSession: Session = {
      ...session,
      participants: [
        ...session.participants,
        {
          id: nextId,
          name: nicknameInput.trim(),
          answers: createEmptyAnswers(),
          completed: false,
        },
      ],
    };

    updateSessionForParticipant(nextSession);
    setParticipantId(nextId);
    setSelectedParticipantId(nextId);
    setNicknameInput("");
    setAlert("已加入，等待發起人開始問答。 ");
  };

  const updateParticipantName = (participantIdToUpdate: string, newName: string) => {
    if (!session) return;

    const nextParticipants = session.participants.map((participant) =>
      participant.id === participantIdToUpdate ? { ...participant, name: newName } : participant,
    );

    const nextSession = { ...session, participants: nextParticipants };
    setSession(nextSession);
    saveSession(nextSession);
  };

  const handleAddParticipant = () => {
    if (!session || !nicknameInput.trim()) {
      setAlert("請輸入暱稱。 ");
      return;
    }

    const nextId = `participant-${Date.now().toString(36)}`;
    const nextSession: Session = {
      ...session,
      participants: [
        ...session.participants,
        {
          id: nextId,
          name: nicknameInput.trim(),
          answers: createEmptyAnswers(),
          completed: false,
        },
      ],
    };

    updateSessionForParticipant(nextSession);
    setParticipantId(nextId);
    setSelectedParticipantId(nextId);
    setNicknameInput("");
    setView("participant");
    setAlert("");
  };

  const updateInitiatorAnswer = (questionIndex: number, value: string) => {
    setSession((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        initiatorAnswers: prev.initiatorAnswers.map((answer, index) =>
          index === questionIndex ? value : answer,
        ),
      };
    });
  };

  const updateParticipantAnswer = (index: number, value: string) => {
    if (!session || !participantId) return;

    const nextSession: Session = {
      ...session,
      participants: session.participants.map((participant) =>
        participant.id === participantId
          ? {
              ...participant,
              answers: participant.answers.map((answer, answerIndex) =>
                answerIndex === index ? value : answer,
              ),
            }
          : participant,
      ),
    };

    updateSessionForParticipant(nextSession);
  };

  const submitParticipantAnswers = () => {
    if (!session || !participantId) return;

    const nextSession = { ...session };
    updateSessionForParticipant(nextSession);
    setAlert("本題答案已提交，請等待其他玩家。發起人確認後會進入下一題。 ");
    setSelectedParticipantId(participantId);
  };

  const getAllParticipantsCompleted = () => {
    if (!session) return false;
    return (
      session.participants.length > 0 &&
      session.participants.every((participant) => participant.answers.every((a) => (a ?? "").trim() !== ""))
    );
  };

  const renderQuestionInputs = (
    answers: string[],
    onChange: (index: number, value: string) => void,
  ) =>
    questions.map((question, index) => (
      <div key={question.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-4">
          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
            {question.category}
          </span>
          <span className="text-xs text-slate-500">Q{index + 1}</span>
        </div>
        <p className="mb-3 text-sm font-medium leading-6 text-slate-700">{question.question}</p>
        <textarea
          value={answers[index] ?? ""}
          onChange={(event) => onChange(index, event.target.value)}
          placeholder="請填寫你的答案..."
          className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
        />
      </div>
    ));

  const renderResults = () => {
    if (!session || !currentTarget) return null;

    return (
      <div className="space-y-6">
        <div className="rounded-3xl bg-gradient-to-r from-sky-700 to-indigo-700 p-6 text-white shadow-lg">
          <p className="text-sm uppercase tracking-[0.2em] text-sky-100">結果總覽</p>
          <h2 className="mt-3 text-3xl font-bold">{currentTarget.name}</h2>
          <p className="mt-2 text-sky-100">
            共 {currentResults.filter((item) => item.correct).length} / {questions.length} 題正確
          </p>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800">全員答對率</h3>
          <div className="space-y-3">
            {leaderBoard.map((participant) => (
              <div key={participant.id}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                  <button
                    type="button"
                    onClick={() => setSelectedParticipantId(participant.id)}
                    className="font-medium text-left underline decoration-sky-500 underline-offset-2"
                  >
                    {participant.name}
                  </button>
                  <span>{participant.correctCount} / {questions.length}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500"
                    style={{ width: `${(participant.correctCount / questions.length) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800">逐題檢討</h3>
          {currentResults.map((item, index) => (
            <div key={item.questionId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Q{index + 1}</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    item.correct ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {item.correct ? "正確" : "錯誤"}
                </span>
              </div>
              <p className="mb-3 text-sm text-slate-700">
                <span className="font-medium">題目：</span>
                {questions[index].question}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">發起人答案</p>
                  <p className="mt-2 text-sm text-slate-700">{item.initiatorAnswer || "未填寫"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">你的答案</p>
                  <p className="mt-2 text-sm text-slate-700">{item.participantAnswer || "未填寫"}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
                <span>相似度</span>
                <span className="font-semibold">{item.similarity}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (view === "home") {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_#eff6ff,_#f8fafc_45%,_#eef2ff_100%)] px-4 py-10 text-slate-800">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 rounded-3xl border border-sky-100 bg-white/80 p-8 shadow-xl backdrop-blur-sm">
            <p className="text-sm font-medium uppercase tracking-[0.26em] text-sky-700">團契互動遊戲</p>
            <h1 className="mt-4 text-4xl font-black text-slate-900">磐石自介</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
              透過自我介紹與與上帝的連結，讓團契朋友更快認識彼此，也一同學習理解與回應神的恩典。
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-1">
            {session ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">已建立遊戲</div>
                    <h3 className="mt-2 text-2xl font-bold text-slate-900">分享連結</h3>
                    <p className="mt-3 text-sm text-slate-600">請將下方連結傳給團契成員，所有打開連結的人只會看到暱稱輸入頁面。</p>
                  </div>
                  <div className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={copyShareLink}
                      className="rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white"
                    >
                      複製連結
                    </button>
                  </div>
                </div>
                <div className="mt-4 break-all rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">{buildShareUrl(session.sessionId)}</div>
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={startQuestionRound}
                    className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white"
                  >
                    {session.hasStarted ? "重新開始問答" : "開始問答"}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setSession(null);
                    setView("initiator");
                  }}
                  className="rounded-3xl bg-sky-600 p-6 text-left text-white shadow-lg transition hover:bg-sky-700"
                >
                  <div className="text-sm font-medium uppercase tracking-[0.2em] text-sky-100">建立新遊戲</div>
                  <div className="mt-4 text-2xl font-bold">建立並產生分享連結</div>
                  <p className="mt-3 text-sm text-sky-100">點選後會產生分享連結，請使用該連結邀請成員加入。</p>
                </button>
              </div>
            )}
          </div>

          {alert ? <div className="mt-6 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{alert}</div> : null}
        </div>
      </main>
    );
  }

  if (view === "initiator") {
    if (!session) {
      return (
        <main className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
            <h2 className="text-2xl font-bold text-slate-900">建立團契遊戲</h2>
            <p className="mt-3 text-sm text-slate-600">先輸入你的暱稱，之後按開始即可直接進入問答。</p>
            <input
              value={initiatorName}
              onChange={(event) => setInitiatorName(event.target.value)}
              className="mt-5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-500"
              placeholder="你的暱稱"
            />
            <button
              type="button"
              onClick={createSession}
              className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-3 font-medium text-white"
            >
              開始填答
            </button>
          </div>
        </main>
      );
    }

    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-slate-800">
        <div className="mb-6 flex flex-col gap-3 rounded-3xl bg-slate-900 p-5 text-white shadow-lg md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">發起人模式</p>
            <h2 className="mt-2 text-2xl font-bold">{session.initiatorName || "發起人"}</h2>
          </div>
          <button
            type="button"
            onClick={copyShareLink}
            className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15"
          >
            複製分享連結
          </button>
        </div>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">分享連結</div>
          <div className="mt-3 break-all rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-700">
            {buildShareUrl(session.sessionId)}
          </div>
        </div>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">已加入的玩家</h3>
              <p className="text-sm text-slate-500">所有玩家都可自訂暱稱，發起人也可在此編輯。</p>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {session.participants.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">
                還沒有人加入，請將連結分享給玩家。
              </div>
            ) : (
              session.participants.map((participant) => (
                <ParticipantCard
                  key={participant.id}
                  participant={participant}
                  onEditName={updateParticipantName}
                />
              ))
            )}
          </div>
          <div className="mt-4 flex flex-col gap-3 md:flex-row">
            <input
              value={nicknameInput}
              onChange={(event) => setNicknameInput(event.target.value)}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-500"
              placeholder="輸入玩家暱稱"
            />
            <button
              type="button"
              onClick={handleAddParticipant}
              className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white"
            >
              新增玩家
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {renderQuestionInputs(session.initiatorAnswers, updateInitiatorAnswer)}
        </div>

        <div className="mt-8 flex flex-col justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row">
          <div className="text-sm text-slate-500">
            已填答：{session.initiatorAnswers.filter((answer) => answer.trim()).length} / {questions.length}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setView("home")}
              className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700"
            >
              返回首頁
            </button>
            <button
              type="button"
              onClick={startQuestionRound}
              className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-medium text-white"
            >
              {session.hasStarted ? "重新開始問答" : "開始問答"}
            </button>
            <button
              type="button"
              onClick={revealRoundAnswers}
              disabled={!allAnsweredCurrent()}
              className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              看所有人答案
            </button>
            <button
              type="button"
              onClick={openResults}
              disabled={!getAllParticipantsCompleted()}
              className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              查看最終成績
            </button>
          </div>
        </div>
        {showAnswers && session ? (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800">本題所有答案</h3>
            <div className="mt-4 space-y-3">
              {buildRoundReviewData(session).map((item) => (
                <div key={item.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-slate-700">{item.name}</div>
                    <div className="text-sm text-slate-500">{item.answer ? "已作答" : "未作答"}</div>
                  </div>
                  <div className="mt-2 text-sm text-slate-700">{item.answer || "(未填寫)"}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={advanceToNextQuestion}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
              >
                {session.currentQuestionIndex >= questions.length - 1 ? "查看最終成績" : "下一題"}
              </button>
            </div>
          </div>
        ) : null}
      </main>
    );
  }

  if (view === "participant") {
    if (!session) {
      return null;
    }

    if (!participantId) {
      return (
        <main className="mx-auto max-w-xl px-4 py-12 text-slate-800">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-sky-700">加入作答</p>
            <h2 className="mt-3 text-3xl font-bold text-slate-900">輸入你的暱稱</h2>
            <p className="mt-3 text-sm text-slate-600">每位玩家可自訂暱稱，進入後直接開始作答。</p>
            <input
              value={nicknameInput}
              onChange={(event) => setNicknameInput(event.target.value)}
              className="mt-5 w-full rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none focus:border-sky-500"
              placeholder="你的暱稱"
            />
            <button
              type="button"
              onClick={joinParticipantFromLink}
              className="mt-5 w-full rounded-xl bg-sky-600 px-4 py-3 font-medium text-white"
            >
              進入作答
            </button>
            {alert ? <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{alert}</div> : null}
          </div>
        </main>
      );
    }

    const roundStarted = !!session.hasStarted;

    return (
      <main className="mx-auto max-w-5xl px-4 py-8 text-slate-800">
        <div className="mb-6 rounded-3xl bg-slate-900 p-6 text-white shadow-lg">
          <p className="text-sm uppercase tracking-[0.2em] text-slate-300">作答者模式</p>
          <h2 className="mt-3 text-3xl font-bold">{currentTarget?.name || "作答者"}</h2>
          {!roundStarted ? (
            <p className="mt-2 text-sm text-slate-300">等待發起人按下「開始問答」後，題目才會顯示。</p>
          ) : null}
        </div>

        {!roundStarted ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-6 text-center text-slate-600">
            發起人尚未開始問答，請稍候。
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {session && currentTarget ? (
                (() => {
                  const idx = session.currentQuestionIndex ?? 0;
                  const question = questions[idx];
                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">{question.category}</span>
                        <span className="text-xs text-slate-500">Q{idx + 1}</span>
                      </div>
                      <p className="mb-3 text-sm font-medium leading-6 text-slate-700">{question.question}</p>
                      <textarea
                        value={currentTarget.answers[idx] ?? ""}
                        onChange={(event) => updateParticipantAnswer(idx, event.target.value)}
                        placeholder="請填寫你的答案..."
                        className="min-h-28 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
                      />
                    </div>
                  );
                })()
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-slate-500">請先由發起人新增或加入會話。</div>
              )}
            </div>

            <div className="mt-8 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-500">
                已填答：{(currentTarget?.answers.filter((answer) => answer.trim()).length ?? 0)} / {questions.length}
              </div>
              <button
                type="button"
                onClick={submitParticipantAnswers}
                className="rounded-xl bg-sky-600 px-4 py-3 text-sm font-medium text-white"
              >
                提交答案
              </button>
            </div>
          </>
        )}
      </main>
    );
  }

  if (view === "results") {
    if (!session) {
      return null;
    }

    return (
      <main className="mx-auto max-w-6xl px-4 py-8 text-slate-800">
        <div className="mb-6 flex flex-col gap-4 rounded-3xl bg-slate-900 p-6 text-white shadow-lg md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-300">成績結果</p>
            <h2 className="mt-2 text-3xl font-bold">{session.initiatorName} 的團契自我介紹遊戲</h2>
          </div>
          <button
            type="button"
            onClick={() => setView("home")}
            className="rounded-xl bg-white px-4 py-3 text-sm font-medium text-slate-900"
          >
            返回首頁
          </button>
        </div>

        {alert ? <div className="mb-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{alert}</div> : null}
        {renderResults()}
      </main>
    );
  }

  return null;
}
