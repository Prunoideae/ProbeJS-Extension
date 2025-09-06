import * as vscode from 'vscode';

export class ProbeColorProvider implements vscode.DocumentColorProvider {
    // Matches a color hex string, usually '#RRGGBB' or "#AARRGGBB", both quotes are possible
    private readonly hexColorRegex = /(['"])(#[0-9a-fA-F]{6,8})\1/g;
    
    // Matches a Color.rgba(r, g, b, a) call
    private readonly rgbaColorRegex = /Color\.rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/g;

    provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
        const colors: vscode.ColorInformation[] = [];
        const text = document.getText();

        // Find hex colors
        let match;
        while ((match = this.hexColorRegex.exec(text)) !== null) {
            const range = new vscode.Range(
                document.positionAt(match.index),
                document.positionAt(match.index + match[0].length)
            );
            
            const color = this.parseHexColor(match[2]);
            if (color) {
                colors.push(new vscode.ColorInformation(range, color));
            }
        }

        // Reset regex lastIndex for next search
        this.hexColorRegex.lastIndex = 0;

        // Find Color.rgba() calls
        while ((match = this.rgbaColorRegex.exec(text)) !== null) {
            const range = new vscode.Range(
                document.positionAt(match.index),
                document.positionAt(match.index + match[0].length)
            );
            
            const color = this.parseRgbaColor(
                parseFloat(match[1]),
                parseFloat(match[2]),
                parseFloat(match[3]),
                parseFloat(match[4])
            );
            if (color) {
                colors.push(new vscode.ColorInformation(range, color));
            }
        }

        // Reset regex lastIndex
        this.rgbaColorRegex.lastIndex = 0;

        return colors;
    }

    provideColorPresentations(color: vscode.Color, context: { document: vscode.TextDocument; range: vscode.Range }): vscode.ColorPresentation[] {
        const text = context.document.getText(context.range);
        const presentations: vscode.ColorPresentation[] = [];

        // Check if it's a hex color format
        const hexMatch = text.match(/(['"])(#[0-9a-fA-F]{6,8})\1/);
        if (hexMatch) {
            const quote = hexMatch[1];
            const originalLength = hexMatch[2].length;
            
            // Preserve the original format (6 or 8 characters)
            const newHex = this.colorToHex(color, originalLength === 9); // 9 includes the #
            presentations.push({
                label: `${quote}${newHex}${quote}`
            });
        }

        // Check if it's a Color.rgba format
        const rgbaMatch = text.match(/Color\.rgba\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*\)/);
        if (rgbaMatch) {
            const r = Math.round(color.red * 255);
            const g = Math.round(color.green * 255);
            const b = Math.round(color.blue * 255);
            const a = color.alpha;
            
            presentations.push({
                label: `Color.rgba(${r}, ${g}, ${b}, ${a})`
            });
        }

        return presentations;
    }

    private parseHexColor(hex: string): vscode.Color | null {
        // Remove the # if present
        const cleanHex = hex.replace('#', '');
        
        if (cleanHex.length === 6) {
            // RGB format
            const r = parseInt(cleanHex.substr(0, 2), 16) / 255;
            const g = parseInt(cleanHex.substr(2, 2), 16) / 255;
            const b = parseInt(cleanHex.substr(4, 2), 16) / 255;
            return new vscode.Color(r, g, b, 1);
        } else if (cleanHex.length === 8) {
            // ARGB format
            const a = parseInt(cleanHex.substr(0, 2), 16) / 255;
            const r = parseInt(cleanHex.substr(2, 2), 16) / 255;
            const g = parseInt(cleanHex.substr(4, 2), 16) / 255;
            const b = parseInt(cleanHex.substr(6, 2), 16) / 255;
            return new vscode.Color(r, g, b, a);
        }
        
        return null;
    }

    private parseRgbaColor(r: number, g: number, b: number, a: number): vscode.Color | null {
        // Normalize values to 0-1 range
        const normalizedR = Math.max(0, Math.min(1, r / 255));
        const normalizedG = Math.max(0, Math.min(1, g / 255));
        const normalizedB = Math.max(0, Math.min(1, b / 255));
        const normalizedA = Math.max(0, Math.min(1, a));
        
        return new vscode.Color(normalizedR, normalizedG, normalizedB, normalizedA);
    }

    private colorToHex(color: vscode.Color, includeAlpha: boolean): string {
        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);
        const a = Math.round(color.alpha * 255);
        
        const toHex = (n: number) => n.toString(16).padStart(2, '0').toUpperCase();
        
        if (includeAlpha) {
            return `#${toHex(a)}${toHex(r)}${toHex(g)}${toHex(b)}`;
        } else {
            return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
        }
    }
}