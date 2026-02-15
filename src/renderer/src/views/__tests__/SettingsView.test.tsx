import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SettingsView from '../SettingsView'
import type { ConfigSchemaMetadata, MaskedConfig } from '../../../../shared/config/types'

// Mock window.api
const mockApi = {
  invoke: vi.fn()
}

const mockSchema: ConfigSchemaMetadata = {
  'llm.provider': {
    key: 'llm.provider',
    default: 'openrouter',
    sensitive: false,
    label: 'LLM Provider',
    description: 'The LLM provider to use',
    group: 'LLM',
    zodType: 'ZodEnum',
    enumOptions: ['openrouter']
  },
  'llm.apiKey': {
    key: 'llm.apiKey',
    sensitive: true,
    label: 'API Key',
    description: 'Your API key',
    group: 'LLM',
    zodType: 'ZodString'
  },
  'llm.model': {
    key: 'llm.model',
    default: 'anthropic/claude-3.5-sonnet',
    sensitive: false,
    label: 'Model',
    description: 'The default model',
    group: 'LLM',
    zodType: 'ZodString'
  }
}

const mockValues: MaskedConfig = {
  'llm.provider': 'openrouter',
  'llm.apiKey': '***',
  'llm.model': 'anthropic/claude-3.5-sonnet'
}

describe('SettingsView', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      value: mockApi,
      writable: true,
      configurable: true
    })

    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'config:getSchema') {
        return Promise.resolve(mockSchema)
      }
      if (channel === 'config:getAll') {
        return Promise.resolve(mockValues)
      }
      if (channel === 'config:set') {
        return Promise.resolve(true)
      }
      return Promise.resolve()
    })
  })

  it('loads and displays schema', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    expect(screen.getByLabelText('LLM Provider')).toBeInTheDocument()
    expect(screen.getByLabelText('API Key')).toBeInTheDocument()
    expect(screen.getByLabelText('Model')).toBeInTheDocument()
  })

  it('groups settings by group name', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('LLM')).toBeInTheDocument()
    })
  })

  it('renders enum fields as select inputs', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      const providerInput = screen.getByLabelText('LLM Provider')
      expect(providerInput.tagName).toBe('SELECT')
    })
  })

  it('renders string fields as text inputs', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      const modelInput = screen.getByLabelText('Model')
      expect(modelInput.tagName).toBe('INPUT')
      expect(modelInput).toHaveAttribute('type', 'text')
    })
  })

  it('renders sensitive fields as password inputs', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      const apiKeyInput = screen.getByLabelText('API Key')
      expect(apiKeyInput.tagName).toBe('INPUT')
      expect(apiKeyInput).toHaveAttribute('type', 'password')
    })
  })

  it('displays first-run message when firstRun prop is true', async () => {
    render(<SettingsView firstRun={true} />)

    await waitFor(() => {
      expect(screen.getByText(/Welcome to Chaos Coordinator/)).toBeInTheDocument()
    })
  })

  it('does not display first-run message by default', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('Settings')).toBeInTheDocument()
    })

    expect(screen.queryByText(/Welcome to Chaos Coordinator/)).not.toBeInTheDocument()
  })

  it('saves value on blur for text inputs', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByLabelText('Model')).toBeInTheDocument()
    })

    const modelInput = screen.getByLabelText('Model')

    // Focus, change, and blur
    fireEvent.focus(modelInput)
    fireEvent.change(modelInput, { target: { value: 'new-model' } })
    fireEvent.blur(modelInput)

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('config:set', {
        key: 'llm.model',
        value: 'new-model'
      })
    })
  })

  it('saves immediately for select inputs', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByLabelText('LLM Provider')).toBeInTheDocument()
    })

    const providerSelect = screen.getByLabelText('LLM Provider')

    fireEvent.change(providerSelect, { target: { value: 'openrouter' } })

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('config:set', {
        key: 'llm.provider',
        value: 'openrouter'
      })
    })
  })

  it('displays toast notification after save', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByLabelText('Model')).toBeInTheDocument()
    })

    const modelInput = screen.getByLabelText('Model')

    fireEvent.focus(modelInput)
    fireEvent.change(modelInput, { target: { value: 'new-model' } })
    fireEvent.blur(modelInput)

    await waitFor(() => {
      expect(screen.getByText('Saved')).toBeInTheDocument()
    })
  })

  it('shows "Configured" badge for saved sensitive fields', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByText('Configured')).toBeInTheDocument()
    })

    // The API key input should have the replacement placeholder
    const apiKeyInput = screen.getByLabelText('API Key')
    expect(apiKeyInput).toHaveAttribute('placeholder', 'Enter new value to replace')
  })

  it('shows "Not configured" placeholder for unconfigured sensitive fields', async () => {
    const unconfiguredValues: MaskedConfig = {
      'llm.provider': 'openrouter',
      'llm.model': 'anthropic/claude-3.5-sonnet'
    }

    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'config:getSchema') {
        return Promise.resolve(mockSchema)
      }
      if (channel === 'config:getAll') {
        return Promise.resolve(unconfiguredValues)
      }
      return Promise.resolve()
    })

    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByLabelText('API Key')).toBeInTheDocument()
    })

    const apiKeyInput = screen.getByLabelText('API Key')
    expect(apiKeyInput).toHaveAttribute('placeholder', 'Not configured')
    expect(screen.queryByText('Configured')).not.toBeInTheDocument()
  })

  it('handles save errors', async () => {
    mockApi.invoke.mockImplementation((channel: string) => {
      if (channel === 'config:getSchema') {
        return Promise.resolve(mockSchema)
      }
      if (channel === 'config:getAll') {
        return Promise.resolve(mockValues)
      }
      if (channel === 'config:set') {
        return Promise.reject(new Error('Validation failed'))
      }
      return Promise.resolve()
    })

    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByLabelText('Model')).toBeInTheDocument()
    })

    const modelInput = screen.getByLabelText('Model')

    // Change to a non-empty value to trigger save
    fireEvent.focus(modelInput)
    fireEvent.change(modelInput, { target: { value: 'invalid-model' } })
    fireEvent.blur(modelInput)

    await waitFor(() => {
      expect(screen.getByText('Validation failed')).toBeInTheDocument()
    })
  })

  it('calls reset handler when reset button is clicked', async () => {
    render(<SettingsView />)

    await waitFor(() => {
      expect(screen.getByLabelText('Model')).toBeInTheDocument()
    })

    const resetButtons = screen.getAllByText('Reset to default')
    const modelResetButton = resetButtons.find((button) => {
      const label = button.parentElement?.querySelector('label')
      return label?.textContent === 'Model'
    })

    expect(modelResetButton).toBeInTheDocument()

    if (modelResetButton) {
      fireEvent.click(modelResetButton)
    }

    await waitFor(() => {
      expect(mockApi.invoke).toHaveBeenCalledWith('config:reset', {
        key: 'llm.model'
      })
    })
  })
})
