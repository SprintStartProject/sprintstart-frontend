import {useState} from "react";
import {Bot, Send, Sparkles, User} from "lucide-react";

type Message = {
    text: string,
    type: 'request' | 'response'
}

export function ChatPage() {

    const [ newRequest, setNewRequest ] = useState('');
    const [ messages, setMessages ] = useState<Message[]>([]);
    const [ isThinking, setIsThinking ] = useState(false);

    const newMessage = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        void handleNewMessage();
    };

    const sleep = (ms: number) =>
        new Promise(resolve => setTimeout(resolve, ms));

    const handleNewMessage = async () => {
        setNewRequest('');
        setMessages(prev => [
            ...prev,
            {
                text: newRequest,
                type: 'request'
            }
        ]);
        setIsThinking(true);
        await sleep(2000);
        setMessages(prev => [ ...prev, {
            text: "Sorry, I can't think for myself...",
            type: 'response'
        }]);
        setIsThinking(false);
    }

    return (
        <div className="h-screen flex flex-col">

            <header className="top-0 right-0 w-full p-5 dark:bg-gray-900 sticky flex gap-2 items-center">
                <Sparkles className="text-blue-500"></Sparkles>
                <h1 className="font-bold dark:text-white text-xl">Chat</h1>
            </header>

            { messages.length === 0 && (
                <div className="flex flex-col justify-center items-center h-full">
                    <div className="flex gap-4 items-center justify-center">
                        <Bot className="text-blue-600 size-20"></Bot>
                        <h1 className="text-white font-bold text-2xl">Nice to meet you!</h1>
                    </div>
                    <p className="text-white">I will help you getting started on your project. Just ask me! :)</p>
                </div>
            )}

            <div className="flex flex-1 overflow-y-auto flex-col gap-3 px-3 py-5">

                {messages.map((message, index) => {
                    const isRequest = message.type === "request";

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
                                {message.text}
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

            <footer className="bottom-0 right-0 w-full p-5 dark:bg-gray-900 sticky flex justify-center">
                <form onSubmit={newMessage} className="flex gap-3 w-full">
                    <input
                        type="text"
                        placeholder="Ask anything about the project..."
                        className="flex-1 px-4 rounded-full text-white text-sm dark:bg-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-blue-500 transition"
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