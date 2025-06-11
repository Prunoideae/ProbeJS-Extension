
import * as vscode from 'vscode';
import { ParticipantPrompt } from './copilotPrompt';
import { PromptElementAndProps } from '@vscode/chat-extension-utils/dist/toolsPrompt';
import { sendChatParticipantRequest } from '@vscode/chat-extension-utils';
import { ReadableStream } from 'stream/web';

export function registerChatParticipant(context: vscode.ExtensionContext) {
    let probeParticipant = new CopilotParticipant(context);
    const handler = probeParticipant.chatRequestHandler.bind(probeParticipant);

    const participant = vscode.chat.createChatParticipant('probejs.probeParticipant', handler);
    participant.iconPath = new vscode.ThemeIcon("markdown");
    context.subscriptions.push(participant);
}
const PROMPT = `
Instructions:
- Generate reports based on the Minecraft Game API and user requests.
- Use the provided tools to gather information, when the information is complete, use \`displayReport\` to generate a report.
- The report call should be the last message in the conversation. It would be too crowded if multiple reports popped up at once.
- The report should be in markdown format for easy preview, LaTex formula and Mermaid diagrams (as \`mermaid\` prefix in codeblock) are supported.
- Report should be well-formatted, use list, tables, mermaid figures, and headings to organize the structure. However, do not abuse **bold** formatting as it can be distracting.
- Go beyond the basics to provide a detailed, comprehensive report. Don't hold back. Give it your all.
`;

export class CopilotParticipant {
    constructor(private readonly extensionContext: vscode.ExtensionContext) { }

    async chatRequestHandler(request: vscode.ChatRequest, chatContext: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) {

        const runRequest = async () => {


            const result = sendChatParticipantRequest(
                request,
                chatContext,
                {
                    prompt: PROMPT,
                    tools: vscode.lm.tools.filter(tool => tool.tags.includes("minecraft")),
                    responseStreamOptions: {
                        stream,
                        references: true,
                        responseText: true,
                    },
                    requestJustification: 'To get reports done',
                    extensionMode: this.extensionContext.extensionMode,
                },
                token);

            return await result.result;
        };

        return await runRequest();
    }
}