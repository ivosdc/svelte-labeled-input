import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';

const pkg = require('./package.json');

export default {
    input: [
        'src/index.js'
    ],
    output: [
        {file: pkg.module, format: 'es', name: 'LabeledInput'},
        {file: pkg.main, format: 'es', name: 'LabeledInput'},
    ],
    plugins: [
        svelte({
            customElement: true,
            tag: 'labeled-input',
            emitCss: true,
            css: (css) => {
                css.write('labeled-input.css');
            }
        }),
        resolve({
                extensions: ['.svelte', '.mjs', '.js', '.jsx', '.json'],
                mainFields: ['jsnext:main', 'module', 'main']
            }
        )
    ]
};
