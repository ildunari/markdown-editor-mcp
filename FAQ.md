# Frequently Asked Questions

This document provides answers to the most commonly asked questions about Markdown Editor MCP. If you can't find an answer to your question here, please check the repository issues for additional support.

## Installation and Setup

### How do I install Markdown Editor MCP?

You can install Markdown Editor MCP through npm:

```bash
npm install markdown-editor-mcp
```

Or clone the repository and build from source:

```bash
git clone [repository-url]
cd markdown-editor-mcp
npm install
npm run build
```

### What are the system requirements?

- Node.js 18.0.0 or higher
- Claude Desktop app installed
- npm package manager

## Common Issues

### The server won't start

1. Make sure Node.js version 18 or higher is installed
2. Check that all dependencies are installed with `npm install`
3. Ensure the project is built with `npm run build`
4. Verify your Claude Desktop configuration

### Permission errors

If you encounter permission errors, ensure that:
1. The application has proper file system permissions
2. You're not trying to access restricted system directories
3. Your user account has the necessary privileges

## Configuration

### How do I configure allowed directories?

The server includes configuration options to specify which directories the tool can access. Check the `config.json` file for available options.

### Can I customize the server behavior?

Yes, the server supports various configuration options through:
- Configuration files
- Environment variables
- Runtime parameters

## Troubleshooting

Before diving into specific issues, check the repository issues page to see if your problem has already been reported and if there are any solutions or workarounds.

### Debug mode

You can run the server in debug mode for more detailed logging:

```bash
npm run start:debug
```

### Log files

The server maintains audit logs of all operations. Check the log files for detailed information about any errors or issues.

## Advanced Usage

### Running multiple instances

You can run multiple instances of the server with different configurations by using different ports and configuration files.

### Integration with other tools

The server is designed to work with the Model Context Protocol and can be integrated with other MCP-compatible tools.