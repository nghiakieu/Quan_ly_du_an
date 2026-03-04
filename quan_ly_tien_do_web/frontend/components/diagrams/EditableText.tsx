import React, { useState, useEffect, useRef } from 'react';

interface EditableTextProps {
    x: number;
    y: number;
    value: string;
    fontSize?: number;
    fontWeight?: string | number;
    color?: string;
    anchor?: 'start' | 'middle' | 'end';
    editable?: boolean;
    onSave?: (newValue: string) => void;
    className?: string;
}

export default function EditableText({
    x,
    y,
    value,
    fontSize = 14,
    fontWeight = 'normal',
    color = 'black',
    anchor = 'middle',
    editable = false,
    onSave,
    className = '',
}: EditableTextProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [text, setText] = useState(value);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setText(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleDoubleClick = (e: React.MouseEvent) => {
        if (editable) {
            e.stopPropagation();
            setIsEditing(true);
        }
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (text !== value && onSave) {
            onSave(text);
        } else {
            setText(value); // Revert if no save handler or no change
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            inputRef.current?.blur();
        } else if (e.key === 'Escape') {
            setText(value);
            setIsEditing(false);
        }
        e.stopPropagation(); // Prevent diagram key events
    };

    if (isEditing) {
        // Calculate approximate width to center input if needed
        const width = 200;
        const height = fontSize * 1.5 + 4;
        const inputX = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
        const inputY = y - fontSize; // Adjust slightly to match baseline

        return (
            <foreignObject x={inputX} y={inputY} width={width} height={height}>
                <input
                    ref={inputRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={handleKeyDown}
                    style={{
                        width: '100%',
                        height: '100%',
                        fontSize: `${fontSize}px`,
                        fontWeight: fontWeight,
                        color: color,
                        textAlign: anchor === 'middle' ? 'center' : anchor === 'end' ? 'right' : 'left',
                        background: 'white',
                        border: '1px solid #3b82f6',
                        outline: 'none',
                        padding: 0,
                        margin: 0,
                    }}
                />
            </foreignObject>
        );
    }

    return (
        <text
            x={x}
            y={y}
            textAnchor={anchor}
            fontSize={fontSize}
            fontWeight={fontWeight}
            fill={color}
            onDoubleClick={handleDoubleClick}
            className={`${className} ${editable ? 'cursor-text hover:fill-blue-600' : ''}`}
            style={{ userSelect: 'none' }}
        >
            {text}
        </text>
    );
}
