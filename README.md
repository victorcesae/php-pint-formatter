# PHP Formatter (Laravel Pint)

A VS Code extension that automatically formats PHP files using [Laravel Pint](https://laravel.com/docs/pint) with support for multiple projects in the same workspace.

## Features

- ✨ **Multi-Project Support**: Works with multiple PHP projects in the same workspace
- 🔧 **Auto-Installation**: Automatically installs Laravel Pint if not found (with user confirmation)
- ⚡ **Format on Save**: Automatically formats PHP files when you save them
- 🎯 **Smart Project Detection**: Finds the correct `composer.json` and `vendor/bin/pint` for each file
- 📝 **VS Code Integration**: Full integration with VS Code's formatting system
- ⚙️ **Configurable**: Extensive configuration options
- 🗂️ **Cache Management**: Efficient caching with automatic invalidation

## Requirements

- PHP 8.0 or higher
- Composer installed globally or in your project

## Installation

1. Install the extension from the VS Code marketplace
2. Open a PHP project with `composer.json`
3. The extension will automatically offer to install Laravel Pint if it's not found

## Configuration

The extension provides several configuration options:

```json
{
  "phpFormatter.enabled": true,
  "phpFormatter.formatOnSave": true, 
  "phpFormatter.formatOnType": false,
  "phpFormatter.formatOnPaste": false,
  "phpFormatter.timeout": 30000
}
```

### Configuration Options

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `phpFormatter.enabled` | boolean | `true` | Enable/disable the PHP formatter |
| `phpFormatter.formatOnSave` | boolean | `true` | Format PHP files on save |
| `phpFormatter.formatOnType` | boolean | `false` | Format PHP files while typing |
| `phpFormatter.formatOnPaste` | boolean | `false` | Format PHP files when pasting content |
| `phpFormatter.timeout` | number | `30000` | Timeout in milliseconds for formatting operations |

## Usage

### Automatic Formatting

By default, the extension will format your PHP files when you save them. This behavior can be controlled via the `phpFormatter.formatOnSave` setting.

### Manual Formatting

You can manually format a PHP file using:

- **Command Palette**: `PHP Formatter: Format Document` (`Ctrl+Shift+P`)
- **Keyboard Shortcut**: `Shift+Alt+F` (when editing PHP files)
- **Context Menu**: Right-click in a PHP file and select "Format Document"
- **VS Code Format**: Use VS Code's built-in format command (`Shift+Alt+F`)

### Multi-Project Workspaces

The extension automatically detects which project a PHP file belongs to by:

1. Looking for the nearest `composer.json` file in parent directories
2. Finding the appropriate `vendor/bin/pint` binary for that project
3. Caching the paths for better performance

## Commands

The extension provides the following commands:

- `PHP Formatter: Format Document` - Format the current PHP document
- `PHP Formatter: Clear Cache` - Clear the cached Pint binary paths

## How It Works

1. **Project Detection**: When you edit a PHP file, the extension finds the nearest `composer.json`
2. **Binary Location**: It locates the `vendor/bin/pint` binary for that project
3. **Auto-Installation**: If Pint isn't found, it offers to install it via Composer
4. **Formatting**: Uses Laravel Pint with the project's configuration (if any)
5. **Caching**: Caches binary paths and invalidates cache when `vendor` folders change

## Laravel Pint Configuration

The extension respects your project's Laravel Pint configuration. You can customize Pint's behavior by creating a `pint.json` file in your project root:

```json
{
    "preset": "laravel",
    "rules": {
        "simplified_null_return": true,
        "braces": false,
        "new_with_braces": {
            "anonymous_class": false,
            "named_class": false
        }
    }
}
```

For more information about Laravel Pint configuration, see the [official documentation](https://laravel.com/docs/pint).

## Troubleshooting

### Pint Not Found

If the extension can't find Laravel Pint:

1. Make sure Composer is installed
2. Run `composer require laravel/pint --dev` in your project
3. Use the "PHP Formatter: Clear Cache" command to refresh paths

### Permission Issues

If you encounter permission errors:

1. Ensure the `vendor/bin/pint` file is executable
2. Check that your PHP binary is accessible
3. Verify Composer dependencies are properly installed

### Performance Issues

If formatting is slow:

1. Increase the `phpFormatter.timeout` setting
2. Ensure your project doesn't have too many nested directories
3. Use the "PHP Formatter: Clear Cache" command if paths become stale

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This extension is released under the [MIT License](LICENSE).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

---

**Enjoy formatting your PHP code with Laravel Pint! 🚀**
