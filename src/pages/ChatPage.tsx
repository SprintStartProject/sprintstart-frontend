import {useState} from "react";
import {Bot, Plus, Send, Sparkles, User} from "lucide-react";
import type {Chat, ChatMessage} from "../services/chatService.ts";
import { useChat } from "../hooks/useChat.ts"
import {NavLink} from "react-router-dom";

export function ChatPage() {

    const { chat, chatId, chats, addMessage, isThinking } = useChat();
    const [ newRequest, setNewRequest ] = useState('');
    const [ messages, setMessages ] = useState<ChatMessage[]>([]);

    // const chars = ["How to set up project in TypeScript", "How to structure project", "Meaning of ADRs and Runbooks", "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m", "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x"]

    return (
        <div className="h-screen flex">

            { chats?.length !== 0 && (
                <aside className="fixed right-0 top-0 h-screen w-55 py-20 bg-gray-950 border-l-2 border-gray-800 overflow-y-auto">
                    <div className="flex flex-col gap-1 px-1">

                        <NavLink to={'/chat'} className="bg-blue-600 rounded-full hover:bg-blue-700 flex justify-center gap-1 items-center text-sm font-semibold truncate hover:cursor-pointer p-2 mx-2 text-white transition">
                            <Plus></Plus>
                            New Chat
                        </NavLink>

                        <p className="text-white p-2 pb-0 text-sm font-semibold">
                            Chats:
                        </p>

                        {chats?.map((chat, index) => {
                            return (
                                <NavLink
                                    key={index}
                                    to={'chat/' + chat.id}
                                    className="hover:bg-gray-800 hover:rounded-full flex justify-start text-xs truncate hover:cursor-pointer px-2 py-1 text-white transition"
                                >
                                    {chat.title}
                                </NavLink>
                            );
                        })}

                    </div>
                </aside>
            )}

            <div className="flex flex-col flex-1">
                <header className="top-0 right-0 w-full p-5 h-20 dark:bg-gray-900 sticky flex gap-2 items-center">
                    <Sparkles className="text-blue-500"></Sparkles>
                    <h1 className="font-bold dark:text-white text-xl">Chat</h1>
                </header>

                { messages.length === 0 && (
                    <div className={`flex flex-col justify-center items-center h-full ${chats?.length === 0 ? "pr-0" : "pr-55"}`}>
                        <div className="flex gap-4 items-center justify-center">
                            <Bot className="text-blue-600 size-20"></Bot>
                            <h1 className="text-white font-bold text-2xl">Nice to meet you!</h1>
                        </div>
                        <p className="text-white">I will help you getting started on your project. Just ask me! :)</p>
                    </div>
                )}

                <div className={`flex flex-1 overflow-y-auto flex-col gap-3 px-3 py-5 ${chats?.length === 0 ? "pr-3" : "pr-58"}`}>

                    {messages.map((message, index) => {
                        const isRequest = message.role === "USER";

                        return (
                            <div
                                key={index}
                                className={`flex w-full gap-2 ${isRequest ? "justify-end" : "justify-start"}`}
                            >
                                {!isRequest && (
                                    <Bot className="dark:text-blue-600 mt-1.5"></Bot>
                                )}
                                <div
                                    className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm text-white
                                        ${isRequest ? "bg-blue-600" : "bg-gray-800"}
                                    `}
                                >
                                    {message.content}
                                </div>
                                {isRequest && (
                                    <User className="dark:text-blue-600 mt-1.5"></User>
                                )}
                            </div>
                        );
                    })}

                    {isThinking && (
                        <div
                            className="flex w-full gap-2 justify-start"
                        >
                            <Bot className="dark:text-blue-600 mt-1.5"></Bot>
                            <div className="max-w-[70%] px-4 py-2 rounded-2xl text-sm text-white bg-gray-800">
                                ...
                            </div>
                        </div>
                    )}
                </div>

                <footer className="bottom-0 right-0 w-full p-5 h-20 dark:bg-gray-900 sticky flex justify-center">
                    <form onSubmit={addMessage} className="flex gap-3 w-full">
                        <input
                            type="text"
                            placeholder="Ask anything about the project..."
                            className="flex-1 px-4 rounded-full text-white text-sm dark:bg-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition"
                            value={newRequest}
                            onChange={e => setNewRequest(e.currentTarget.value)}
                        />

                        <button
                            type="submit"
                            disabled={isThinking}
                            className="px-2 py-2 bg-blue-600 text-white rounded-full hover:cursor-pointer hover:bg-blue-700"
                        >
                            <Send></Send>
                        </button>
                    </form>
                </footer>
            </div>
        </div>
    );
}