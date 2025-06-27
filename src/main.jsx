import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import './index.css';

const CalendarApp = () => {
  const [activeTab, setActiveTab] = useState('calendar');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [showFreeTime, setShowFreeTime] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [expandedEvents, setExpandedEvents] = useState({});
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('events');
    if (stored) setEvents(JSON.parse(stored, (key, value) =>
      ['start', 'end'].includes(key) ? new Date(value) : value
    ));
  }, []);

  useEffect(() => {
    localStorage.setItem('events', JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    if (events.length === 0) {
      const demo = [];
      const today = new Date();
      today.setHours(9, 0, 0, 0);
      for (let i = 0; i < 5; i++) {
        const start = new Date(today);
        start.setHours(9 + i * 2);
        const end = new Date(start);
        end.setHours(start.getHours() + 1);
        demo.push({
          id: (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)),
          title: `デモ予定${i + 1}`,
          start,
          end,
          journal: '',
          tag: 'blue'
        });
      }
      setEvents(demo);
    }
  }, []);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear(), month = date.getMonth();
    const first = new Date(year, month, 1), last = new Date(year, month + 1, 0);
    const start = new Date(first); start.setDate(start.getDate() - first.getDay());
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const getFreeTime = (date) => {
    const dayEvents = events.filter(e => e.start.toDateString() === date.toDateString())
      .sort((a, b) => a.start - b.start);
    const free = [], workStart = new Date(date), workEnd = new Date(date);
    workStart.setHours(9, 0, 0); workEnd.setHours(18, 0, 0);
    if (!dayEvents.length) return [{ start: workStart, end: workEnd }];
    if (dayEvents[0].start > workStart) free.push({ start: workStart, end: dayEvents[0].start });
    for (let i = 0; i < dayEvents.length - 1; i++) {
      if (dayEvents[i].end < dayEvents[i + 1].start)
        free.push({ start: dayEvents[i].end, end: dayEvents[i + 1].start });
    }
    if (dayEvents.at(-1).end < workEnd) free.push({ start: dayEvents.at(-1).end, end: workEnd });
    return free.filter(s => s.end - s.start >= 30 * 60 * 1000);
  };

  const formatTime = date =>
    date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const formatDate = date =>
    date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

  const updateJournal = (id, journal) => {
    const updated = events.map(ev => ev.id === id ? { ...ev, journal } : ev);
    setEvents(updated);
  };

  const addSampleEvent = () => {
    const dayEvents = events.filter(e => e.start.toDateString() === selectedDate.toDateString());
    const base = new Date(selectedDate);
    base.setHours(9 + dayEvents.length * 2, 0, 0, 0);
    const start = new Date(base);
    const end = new Date(start);
    end.setHours(start.getHours() + 1);
    const newEvent = {
      id: (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9)),
      title: `新しい予定`,
      start,
      end,
      journal: '',
      tag: 'blue'
    };
    setEvents(prev => [...prev, newEvent]);
  };

  const toggleExpand = (id) => {
    setExpandedEvents(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const CalendarView = () => {
    const days = getDaysInMonth(currentDate);
    const today = new Date();
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="p-2 hover:bg-gray-100 rounded"><ChevronLeft className="w-5 h-5" /></button>
            <h2 className="text-xl font-semibold">
              {currentDate.getFullYear()}年 {currentDate.getMonth() + 1}月
            </h2>
            <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="p-2 hover:bg-gray-100 rounded"><ChevronRight className="w-5 h-5" /></button>
            <button onClick={addSampleEvent}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
              ＋予定追加
            </button>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => setShowFreeTime(!showFreeTime)}
              className={`px-4 py-2 rounded flex items-center space-x-1 ${showFreeTime ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
              <Clock className="w-4 h-4" /><span>空き時間</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-7 border-t border-b">
          {['日', '月', '火', '水', '木', '金', '土'].map(d => (
            <div key={d} className="text-center py-2 font-medium text-gray-600 border-r last:border-r-0">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, i) => {
            const isToday = day.toDateString() === today.toDateString();
            const isCurrent = day.getMonth() === currentDate.getMonth();
            const dayEvents = events.filter(e => e.start.toDateString() === day.toDateString());
            const freeSlots = showFreeTime ? getFreeTime(day) : [];
            return (
              <div key={i}
                className={`min-h-24 p-2 border-r border-b cursor-pointer ${isCurrent ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'} ${isToday ? 'bg-blue-50' : ''}`}
                onClick={() => { if (!isFocused) setSelectedDate(day); }}>
                <div className={`text-sm mb-1 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>{day.getDate()}</div>
                {dayEvents.map(ev => (
                  <div key={ev.id} className={`bg-${ev.tag}-500 text-white text-xs p-1 rounded mb-1`}>
                    <div className="flex justify-between items-center" onClick={(e) => e.stopPropagation()}>
                      <div onClick={(e) => e.stopPropagation()} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}>
                        <input
                          className="w-full bg-transparent border-none text-white text-xs"
                          value={ev.title || ''}
                          onChange={(e) => {
                            const updated = events.map(evn => evn.id === ev.id ? { ...evn, title: e.target.value } : evn);
                            setEvents(updated);
                          }}
                        />
                      </div>
                      <button onClick={(e) => {
                        e.stopPropagation();
                        setEvents(events.filter(evn => evn.id !== ev.id));
                      }} className="ml-1 text-white hover:text-red-200">&times;</button>
                    </div>
                    <div className="mt-1 flex items-center space-x-1">
                      <div onClick={(e) => e.stopPropagation()} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}>
                        <input
                          type="time"
                          className="bg-white text-black text-xs rounded px-1"
                          value={formatTime(ev.start || new Date()).slice(0, 5)}
                          onChange={(e) => {
                            const [h, m] = e.target.value.split(':');
                            const updated = new Date(ev.start);
                            updated.setHours(+h, +m);
                            const newEvents = events.map(evn => evn.id === ev.id ? { ...evn, start: updated } : evn);
                            setEvents(newEvents);
                          }}
                        />
                      </div>
                      <span className="text-white text-xs">-</span>
                      <div onClick={(e) => e.stopPropagation()} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}>
                        <input
                          type="time"
                          className="bg-white text-black text-xs rounded px-1"
                          value={formatTime(ev.end || new Date()).slice(0, 5)}
                          onChange={(e) => {
                            const [h, m] = e.target.value.split(':');
                            const updated = new Date(ev.end);
                            updated.setHours(+h, +m);
                            const newEvents = events.map(evn => evn.id === ev.id ? { ...evn, end: updated } : evn);
                            setEvents(newEvents);
                          }}
                        />
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()} onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}>
                      <select
                        className="text-xs mt-1 bg-white text-black rounded"
                        value={ev.tag || ''}
                        onChange={(e) => {
                          const updated = events.map(evn => evn.id === ev.id ? { ...evn, tag: e.target.value } : evn);
                          setEvents(updated);
                        }}
                      >
                        <option value="blue">青</option>
                        <option value="red">赤</option>
                        <option value="green">緑</option>
                        <option value="yellow">黄</option>
                      </select>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(ev.id);
                      }}
                      className="mt-1 text-xs underline text-white"
                    >
                      {expandedEvents[ev.id] ? '詳細を閉じる' : '詳細を表示'}
                    </button>
                    {expandedEvents[ev.id] && (
                      <div className="mt-2 bg-white text-black p-2 rounded text-xs">
                        <div><strong>タイトル:</strong> {ev.title}</div>
                        <div><strong>開始:</strong> {formatTime(ev.start)}</div>
                        <div><strong>終了:</strong> {formatTime(ev.end)}</div>
                        <div><strong>タグ:</strong> {ev.tag}</div>
                        <div><strong>日記:</strong> {ev.journal || 'なし'}</div>
                      </div>
                    )}
                  </div>
                ))}
                {freeSlots.map((s, idx) => (
                  <div key={idx} className="bg-green-100 text-green-800 text-xs p-1 rounded border border-green-200 mb-1"
                    onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`${formatTime(s.start)}-${formatTime(s.end)}`); setCopySuccess(`${formatTime(s.start)}-${formatTime(s.end)}`) }}>
                    空:{formatTime(s.start)}-{formatTime(s.end)}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const JournalView = () => (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold flex items-center mb-4">
        <BookOpen className="w-6 h-6 mr-2" />イベント日記
      </h2>
      {events.map(ev => (
        <div key={ev.id} className="border rounded-lg p-4 mb-4">
          <div className="flex justify-between mb-2">
            <h3 className="font-semibold">{ev.title}</h3>
            <span className="text-sm text-gray-500">{formatDate(ev.start)}</span>
          </div>
          <div onFocus={() => setIsFocused(true)} onBlur={() => setIsFocused(false)}>
            <textarea
              className="w-full p-2 border rounded-lg resize-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="日記を追加..."
              value={ev.journal || ''}
              onChange={e => {
                updateJournal(ev.id, e.target.value);
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-4 space-x-2">
          <CalendarIcon className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold">カレンダーアプリ</h1>
        </div>
        <div className="flex space-x-2 mb-6">
          <button onClick={() => setActiveTab('calendar')}
            className={`px-4 py-2 rounded ${activeTab === 'calendar' ? 'bg-white shadow' : 'bg-gray-200'}`}>
            カレンダー
          </button>
          <button onClick={() => setActiveTab('journal')}
            className={`px-4 py-2 rounded ${activeTab === 'journal' ? 'bg-white shadow' : 'bg-gray-200'}`}>
            日記
          </button>
        </div>
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'journal' && <JournalView />}
        {copySuccess && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded">
            コピー: {copySuccess}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarApp;

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<CalendarApp />);