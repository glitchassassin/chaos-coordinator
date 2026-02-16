import { useRef } from 'react'
import { textColorOn } from '@shared/lib/color-utils'

interface PalettePickerProps {
  palette: string[]
  selectedColor: string
  onSelect: (hex: string) => void
  label: string
}

export default function PalettePicker({
  palette,
  selectedColor,
  onSelect,
  label
}: PalettePickerProps) {
  const colorInputRef = useRef<HTMLInputElement>(null)

  const textColor = textColorOn(selectedColor)

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium text-gray-300">{label}</span>

      <div className="flex items-center gap-2">
        {palette.map((hex) => (
          <button
            key={hex}
            type="button"
            aria-label={`Select color ${hex}`}
            onClick={() => {
              onSelect(hex)
            }}
            className={`h-8 w-8 rounded-full border-2 transition-transform ${
              selectedColor === hex
                ? 'scale-110 border-white'
                : 'border-transparent hover:scale-105'
            }`}
            style={{ backgroundColor: hex }}
          />
        ))}

        <button
          type="button"
          aria-label="Pick custom color"
          onClick={() => colorInputRef.current?.click()}
          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-dashed border-gray-600 transition-colors hover:border-gray-400"
        >
          <div
            className="h-5 w-5 rounded-full"
            style={{
              background: 'conic-gradient(red, yellow, lime, aqua, blue, magenta, red)'
            }}
          />
        </button>

        <input
          ref={colorInputRef}
          type="color"
          value={selectedColor}
          onChange={(e) => {
            onSelect(e.target.value)
          }}
          className="sr-only"
          aria-label={`${label} custom color picker`}
          tabIndex={-1}
        />
      </div>

      <div
        className="mt-2 rounded-md px-3 py-2 text-sm"
        style={{ backgroundColor: selectedColor, color: textColor }}
      >
        Sample text on {selectedColor}
      </div>
    </div>
  )
}
