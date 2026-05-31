import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {createChat, getChats, getMessages, sendMessage} from "../services/chatService";
import type {Chat, ChatMessage} from "../services/chatService";

export function useChat() {
    const { id: chatId } = useParams();

    const [chat, setChat] = useState<Chat | null>(null);
    const [isThinking, setIsThinking] = useState(false);
    const [chats, setChats] = useState<Chat[] | null>(null);

    useEffect(() => {
        const loadChats = async () => {
            const data = await getChats();
            setChats(data);
        };

        void loadChats();
    }, []);

    useEffect(() => {
        if (!chatId) return;

        getMessages(chatId).then(setChat).catch(console.error);
    }, [chatId]);

    const addMessage = async (text: string) => {

    };

    return {
        chat,
        chatId,
        chats,
        addMessage,
        isThinking
    };
}