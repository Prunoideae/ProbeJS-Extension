import * as vscode from "vscode";
import { PromptElement, BasePromptElementProps, PromptSizing, UserMessage } from "@vscode/prompt-tsx";

export interface ParticipantProps extends BasePromptElementProps {
    request: vscode.ChatRequest;
}

export class ParticipantPrompt extends PromptElement<ParticipantProps, void>{
    render(state: void, sizing: PromptSizing) {
        return (
            <UserMessage>
            </UserMessage>
        );
    }
}


