
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Personnel, LeaveRecord } from '../types';

interface ChatBotProps {
  personnel: Personnel[];
  leaves: LeaveRecord[];
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

const ChatBot: React.FC<ChatBotProps> = ({ personnel, leaves }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Olá! Sou o assistente especialista da Seção Administrativa. Posso analisar qualquer tipo de lançamento (Férias, Abonos, LTSP, Escala Vermelha, etc). Como posso ajudar agora?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const systemInstruction = `
        Você é o Especialista em Inteligência de Dados da Seção Administrativa da PMDF.
        Sua missão é realizar auditoria e fornecer informações detalhadas sobre o efetivo.

        DADOS ATUALIZADOS DO SISTEMA:
        - EFETIVO: ${JSON.stringify(personnel)}
        - HISTÓRICO DE LANÇAMENTOS (TODOS OS TIPOS): ${JSON.stringify(leaves)}
        
        INSTRUÇÕES DE ANÁLISE:
        1. BUSCA: Identifique o militar pelo nome, posto ou matrícula.
        2. ANÁLISE MULTIDIMENSIONAL: 
           Ao ser questionado sobre qualquer afastamento (Férias, Abono, LTSP, Curso, Extra, etc):
           - Localize o saldo atual no cadastro do militar (para Férias e Abono).
           - Liste TODAS as datas encontradas no histórico para o tipo solicitado em uma tabela Markdown.
           - Formato da Tabela: | Data Início | Data Término | Tipo | Observação | Lançador |.
        3. SALDOS ESPECÍFICOS:
           - ABONO: Informe o saldo (campo saldoAbono) e liste as datas individuais.
           - FÉRIAS: Informe o saldo (campo saldoFerias), liste períodos gozados e identifique se há reprogramações ou antecipações.
           - OUTROS: Para LTSP, Curso, etc., apenas liste os períodos e observações.
        4. ESTATÍSTICAS: Se perguntarem sobre o total de abonos ou férias do efetivo, faça a contagem global.

        REGRAS DE RESPOSTA:
        - Use linguagem militar formal (Ex: "O militar em tela...", "Conforme assentamentos...").
        - Caso não encontre registros de um tipo específico no histórico, informe: "Não constam lançamentos de [TIPO] registrados no histórico para este militar, embora o saldo atual seja de [SALDO]."
        - Seja preciso com as datas.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userMessage,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.1,
        },
      });

      const text = response.text || "Desculpe, não consegui processar os dados do histórico no momento.";
      setMessages(prev => [...prev, { role: 'model', text }]);
    } catch (error) {
      console.error("Erro na API Gemini:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Ocorreu um erro ao consultar a base de dados central." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-white text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-slate-100 transition-all z-50 hover:scale-110 active:scale-95 border-2 border-slate-200 overflow-hidden p-2"
      >
        {isOpen ? (
          <i className="fas fa-times text-slate-800 text-xl"></i>
        ) : (
          <img src="logo.png" alt="ChatBot" className="w-full h-full object-contain" />
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 w-[90vw] md:w-[480px] h-[650px] bg-white rounded-3xl shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-10 duration-300">
          <div className="bg-slate-900 p-5 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden p-1">
                <img src="logo.png" alt="PMDF Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h3 className="font-black text-sm tracking-tight uppercase">Analista de Assentamentos</h3>
                <p className="text-[9px] text-blue-400 font-black uppercase tracking-widest">Auditoria em Tempo Real</p>
              </div>
            </div>
            <button onClick={() => setMessages([{ role: 'model', text: 'Histórico reiniciado. Como posso ajudar com a auditoria do efetivo?' }])} className="text-slate-400 hover:text-white">
              <i className="fas fa-trash-can"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/30">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[95%] p-4 rounded-2xl text-[11px] leading-relaxed shadow-sm ${
                  msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-tr-none font-bold' 
                  : 'bg-white text-slate-700 border border-slate-200 rounded-tl-none prose prose-slate max-w-none'
                }`}>
                  {msg.text.split('\n').map((line, i) => (
                    <p key={i} className={i > 0 ? 'mt-1' : ''}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-3">
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cruzando dados do histórico...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-5 border-t border-slate-100 bg-white">
            <div className="relative">
              <input 
                type="text"
                placeholder="Ex: 'Liste as datas de abono e LTSP do Cel Herbert'"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-5 pr-14 py-4 text-xs font-bold focus:ring-2 focus:ring-blue-600 outline-none transition-all"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center hover:bg-blue-600 transition-colors shadow-lg"
              >
                <i className="fas fa-paper-plane text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
