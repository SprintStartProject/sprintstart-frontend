import {useState} from "react";
import {Send, Sparkles} from "lucide-react";
import './ChatPage.css'

type Message = {
    text: string,
    type: 'request' | 'response'
}

export function ChatPage() {

    const [ newRequest, setNewRequest ] = useState('');
    const [ messages, setMessages ] = useState<Message[]>([]);

    const newMessage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void handleNewMessage();
    };

    const handleNewMessage = async () => {
        setNewRequest('');
        const newMessages: Message[] = [...messages, {
            text: newRequest,
            type: 'request'
        }, {
            text: 'Sorry, I can\'t think for myself...',
            type: 'response'
        }];
        setMessages(newMessages);
    }

    return (
        <div className="h-screen flex flex-col">

            <header className="top-0 right-0 w-full p-5 dark:bg-gray-900 sticky flex gap-2 items-center">
                <Sparkles className="text-blue-500"></Sparkles>
                <h1 className="font-bold dark:text-white text-xl">Chat</h1>
            </header>

            <div className="flex flex-1 overflow-y-auto flex-col gap-3 px-3 py-5">
                {messages.map((message, index) => {
                    const isRequest = message.type === "request";

                    return (
                        <div
                            key={index}
                            className={`flex w-full ${isRequest ? "justify-end" : "justify-start"}`}
                        >
                            <div
                                className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm text-white
                                    ${isRequest ? "bg-blue-600" : "bg-gray-800"}
                                `}
                            >
                                {message.text}
                            </div>
                        </div>
                    );
                })}
            </div>

            <footer className="bottom-0 right-0 w-full p-5 dark:bg-gray-900 sticky flex justify-center">
                <form onSubmit={newMessage} className="flex gap-3 w-full">
                    <input
                        type="text"
                        placeholder="Ask anything about the project..."
                        className="flex-1 px-4 rounded-full text-white dark:bg-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition"
                        value={newRequest}
                        onChange={e => setNewRequest(e.currentTarget.value)}
                    />

                    <button
                        type="submit"
                        className="px-2 py-2 bg-blue-600 text-white rounded-full hover:cursor-pointer hover:bg-blue-700"
                    >
                        <Send></Send>
                    </button>
                </form>
            </footer>
        </div>
    );
}