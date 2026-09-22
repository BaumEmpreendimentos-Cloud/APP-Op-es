import React, { useState, useMemo } from 'react';
import { ACADEMY_ARTICLES } from '../data/academyContent';
import { B3_EXPIRATION_LETTERS } from '../data/ibovAssets';
import { AcademyArticle } from '../types';
import { BookOpen, Calendar, Clock, CheckCircle2, Search, ArrowRight, X, HelpCircle, Check, Award } from 'lucide-react';

export const Academy: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [activeArticle, setActiveArticle] = useState<AcademyArticle | null>(null);

  // Knowledge Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);

  const categories = [
    { id: 'ALL', label: 'Todos os Módulos' },
    { id: 'Fundamentos B3', label: 'Fundamentos B3' },
    { id: 'Mecânica Operacional', label: 'Mecânica Operacional' },
    { id: 'Gestão de Risco', label: 'Gestão de Risco' },
    { id: 'Estratégia & Manejo', label: 'Estratégia & Manejo' },
    { id: 'Quantitativo', label: 'Quantitativo' },
    { id: 'Fiscal & Compliance', label: 'Fiscal & IR' },
    { id: 'Dicionário & Termos', label: 'Glossário' },
  ];

  const filteredArticles = useMemo(() => {
    return ACADEMY_ARTICLES.filter((art) => {
      const matchSearch =
        art.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        art.subtitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        art.content.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = selectedCategory === 'ALL' || art.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [searchTerm, selectedCategory]);

  const quizQuestions = [
    {
      question: 'O ticker PETRJ385 sempre terá strike oficial de R$ 38,50 no vencimento?',
      options: [
        'Sim, o número do ticker é imutável e reflete sempre o strike.',
        'Não, se houver distribuição de dividendos ou JCP, a B3 desconta o valor do provento diretamente do strike oficial.',
        'Sim, exceto se a Petrobras fizer grupamento de ações.',
      ],
      correct: 1,
      explanation: 'A B3 ajusta todos os strikes vigentes descontando o valor de proventos (dividendos/JCP) na Data-Ex.',
    },
    {
      question: 'Qual é o estilo de exercício preponderante para PUTs de ações líquidas na B3?',
      options: [
        'Americano (podem ser exercidas a qualquer dia até o vencimento).',
        'Europeu (só podem ser exercidas na 3ª sexta-feira do vencimento).',
        'Asiático (calculado pela média aritmética dos últimos 30 dias).',
      ],
      correct: 1,
      explanation: 'Diferente das CALLs (que são quase 100% Americanas), as PUTs na B3 são praticamente todas de estilo Europeu.',
    },
    {
      question: 'Existe isenção de imposto de renda para vendas até R$ 20.000 no mercado de opções?',
      options: [
        'Sim, a mesma isenção de R$ 20.000 das ações vale para opções.',
        'Não. Não existe isenção alguma para opções; qualquer lucro líquido deve ser tributado a 15% (swing) ou 20% (day trade).',
        'Apenas se a opção for de venda coberta.',
      ],
      correct: 1,
      explanation: 'A isenção mensal de R$ 20 mil é exclusiva do mercado à vista de ações. Derivativos são tributados a partir de R$ 0,01 de lucro líquido.',
    },
    {
      question: 'Qual é a regra mais importante ao executar uma rolagem defensiva?',
      options: [
        'Rolar sempre pagando débito financeiro para ficar em strikes mais distantes.',
        'Rolar sempre gerando crédito líquido financeiro ou no mínimo no zero-a-zero.',
        'Esperar os últimos 5 minutos da sexta-feira do vencimento para rolar.',
      ],
      correct: 1,
      explanation: 'Pagar débito para rolar deteriora o caixa e cria um buraco financeiro cumulativo. Rolagens saudáveis sempre capturam crédito.',
    },
  ];

  const handleSelectQuizOption = (qIdx: number, optIdx: number) => {
    if (quizSubmitted) return;
    setQuizAnswers({ ...quizAnswers, [qIdx]: optIdx });
  };

  const calculateQuizScore = () => {
    let score = 0;
    quizQuestions.forEach((q, idx) => {
      if (quizAnswers[idx] === q.correct) score++;
    });
    return score;
  };

  return (
    <div id="opcoes-academy" className="space-y-8 pb-12">
      {/* Academy Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-sky-950/50 border border-emerald-800/40 p-6 rounded-2xl">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <BookOpen className="w-6 h-6" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Opções ACADEMY B3
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Base de conhecimento avançada e prática para tomada de decisão no mercado brasileiro: mecânica de exercício, sistema CORE de margem, Selic, gregas e regulação fiscal.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
            <Award className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-white block">Formação Profissional B3</span>
              <span className="text-slate-400 text-[11px]">8 Módulos Especializados</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Expiration Matrix B3 */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs sm:text-sm font-bold text-white">
              Tabela Oficial de Letras de Vencimento da B3
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Regra Vigente: <strong>3ª sexta-feira do mês</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 text-center text-xs">
          {B3_EXPIRATION_LETTERS.map((item) => (
            <div
              key={item.month}
              className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1 hover:border-slate-700 transition"
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 block">
                {item.monthName.slice(0, 3)}
              </span>
              <div className="flex items-center justify-around font-mono font-bold text-sm">
                <span className="text-emerald-400" title={`CALL ${item.monthName}`}>
                  {item.callLetter}
                </span>
                <span className="text-slate-600">/</span>
                <span className="text-sky-400" title={`PUT ${item.monthName}`}>
                  {item.putLetter}
                </span>
              </div>
              <span className="text-[9px] text-slate-400 block font-mono">
                Call / Put
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Categories */}
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`text-xs px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar lição ou conceito..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Articles Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredArticles.map((article) => (
            <div
              key={article.id}
              onClick={() => setActiveArticle(article)}
              className="flex flex-col justify-between rounded-2xl bg-slate-900/90 border border-slate-800 p-5 hover:border-emerald-700/60 transition cursor-pointer shadow-lg group"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {article.category}
                  </span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{article.readingMinutes} min</span>
                  </span>
                </div>

                <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition leading-snug">
                  {article.title}
                </h3>

                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                  {article.subtitle}
                </p>

                {/* Key Takeaways preview */}
                <div className="space-y-1 pt-1">
                  {article.keyTakeaways.slice(0, 2).map((takeaway, i) => (
                    <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300">
                      <span className="text-emerald-400 font-bold shrink-0">•</span>
                      <span className="line-clamp-1">{takeaway}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-800/60 flex items-center justify-between text-xs font-semibold text-emerald-400 group-hover:translate-x-1 transition-transform">
                <span>Ler Módulo Completo</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Knowledge Quiz Section */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              <span>Simulador de Fixação & Quiz Prático B3</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Teste seus conhecimentos com 4 perguntas reais sobre armadilhas e regras de opções no Brasil.
            </p>
          </div>

          {quizSubmitted && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 border border-emerald-700/60 text-emerald-400 font-mono text-xs font-bold">
              <span>Resultado: {calculateQuizScore()} de {quizQuestions.length} corretas</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quizQuestions.map((q, qIdx) => (
            <div
              key={qIdx}
              className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-mono text-slate-400 block uppercase font-bold">
                  Pergunta {qIdx + 1} de {quizQuestions.length}
                </span>
                <p className="text-xs font-bold text-slate-200 leading-snug">
                  {q.question}
                </p>

                <div className="space-y-1.5 pt-1">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = quizAnswers[qIdx] === optIdx;
                    const isCorrect = q.correct === optIdx;
                    let btnStyle = 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-850';

                    if (quizSubmitted) {
                      if (isCorrect) {
                        btnStyle = 'bg-emerald-950/90 text-emerald-300 border-emerald-600 font-semibold';
                      } else if (isSelected && !isCorrect) {
                        btnStyle = 'bg-rose-950/90 text-rose-300 border-rose-600';
                      }
                    } else if (isSelected) {
                      btnStyle = 'bg-slate-800 text-white border-emerald-500 font-medium';
                    }

                    return (
                      <button
                        key={optIdx}
                        onClick={() => handleSelectQuizOption(qIdx, optIdx)}
                        className={`w-full text-left p-2.5 rounded-lg border text-xs transition cursor-pointer ${btnStyle}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>

              {quizSubmitted && (
                <div className="pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
                  <span className="font-semibold text-slate-300">Explicação: </span>
                  {q.explanation}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          {quizSubmitted ? (
            <button
              onClick={() => {
                setQuizAnswers({});
                setQuizSubmitted(false);
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
            >
              Refazer Quiz
            </button>
          ) : (
            <button
              onClick={() => setQuizSubmitted(true)}
              disabled={Object.keys(quizAnswers).length < quizQuestions.length}
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow disabled:opacity-50 cursor-pointer"
            >
              Corrigir Respostas
            </button>
          )}
        </div>
      </div>

      {/* Reader Modal for Detailed Article View */}
      {activeArticle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 sm:p-8 max-w-3xl w-full space-y-5 shadow-2xl relative my-8">
            <button
              onClick={() => setActiveArticle(null)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header info */}
            <div className="space-y-1.5 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  {activeArticle.category}
                </span>
                <span className="text-slate-400 text-xs">•</span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {activeArticle.readingMinutes} minutos de leitura
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                {activeArticle.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300">
                {activeArticle.subtitle}
              </p>
            </div>

            {/* Key Takeaways Box */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-800/40 space-y-2">
              <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider block">
                Pontos-Chave para Decisão:
              </span>
              <div className="space-y-1">
                {activeArticle.keyTakeaways.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs text-slate-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                    <span>{point}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Content Body */}
            <div className="text-xs sm:text-sm text-slate-300 leading-relaxed space-y-4 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar whitespace-pre-line">
              {activeArticle.content}
            </div>

            {/* Practical Example Box */}
            {activeArticle.practicalExample && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-1">
                <span className="font-bold text-amber-400 block uppercase tracking-wider text-[10px]">
                  Exemplo Prático na B3:
                </span>
                <p className="text-slate-200 italic leading-relaxed">
                  "{activeArticle.practicalExample}"
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                onClick={() => setActiveArticle(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition cursor-pointer"
              >
                Concluir Leitura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
