import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import PalettePicker from '../PalettePicker'

describe('PalettePicker', () => {
  const palette = ['#ff0000', '#00ff00', '#0000ff']
  const defaultProps = {
    palette,
    selectedColor: '#ff0000',
    onSelect: vi.fn(),
    label: 'Primary Color'
  }

  it('renders the label', () => {
    render(<PalettePicker {...defaultProps} />)
    expect(screen.getByText('Primary Color')).toBeInTheDocument()
  })

  it('renders swatch buttons for each palette color', () => {
    render(<PalettePicker {...defaultProps} />)
    for (const hex of palette) {
      expect(screen.getByLabelText(`Select color ${hex}`)).toBeInTheDocument()
    }
  })

  it('calls onSelect when swatch is clicked', () => {
    const onSelect = vi.fn()
    render(<PalettePicker {...defaultProps} onSelect={onSelect} />)

    fireEvent.click(screen.getByLabelText('Select color #00ff00'))
    expect(onSelect).toHaveBeenCalledWith('#00ff00')
  })

  it('highlights the selected swatch with scale and border', () => {
    render(<PalettePicker {...defaultProps} selectedColor="#ff0000" />)

    const selected = screen.getByLabelText('Select color #ff0000')
    expect(selected.className).toContain('scale-110')
    expect(selected.className).toContain('border-white')

    const unselected = screen.getByLabelText('Select color #00ff00')
    expect(unselected.className).not.toContain('scale-110')
  })

  it('renders a custom color picker button', () => {
    render(<PalettePicker {...defaultProps} />)
    expect(screen.getByLabelText('Pick custom color')).toBeInTheDocument()
  })

  it('renders preview strip with sample text', () => {
    render(<PalettePicker {...defaultProps} selectedColor="#000000" />)
    const preview = screen.getByText(/Sample text on #000000/)
    expect(preview).toBeInTheDocument()
  })

  it('fires onSelect when custom color changes', () => {
    const onSelect = vi.fn()
    render(<PalettePicker {...defaultProps} onSelect={onSelect} />)

    const hiddenInput = screen.getByLabelText('Primary Color custom color picker')
    fireEvent.change(hiddenInput, { target: { value: '#abcdef' } })
    expect(onSelect).toHaveBeenCalledWith('#abcdef')
  })

  it('renders empty palette without crashing', () => {
    render(<PalettePicker {...defaultProps} palette={[]} />)
    expect(screen.getByText('Primary Color')).toBeInTheDocument()
    expect(screen.getByLabelText('Pick custom color')).toBeInTheDocument()
  })
})
