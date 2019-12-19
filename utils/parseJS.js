// utils / parseJS

import {normalize} from 'path';
import {existsSync} from 'fs';

import {rollup} from 'rollup';
import strip from '@rollup/plugin-strip';
import replace from '@rollup/plugin-replace';

import nodeResolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import cleanup from 'rollup-plugin-cleanup';
import terser from 'terser';

import {error, info} from './logger';
import {getConfigs} from '../configs';


const rollupify = async (input, config = {}, replacement = {}) => {
  try {
    info('Start parsing JS file with Rollup...');
    const plugins = [
      nodeResolve(),
      commonjs({
        include: 'node_modules/**',
        sourceMap: false,
      }),
      replace(replacement),
      cleanup({
        comments: 'none',
        maxEmptyLines: 0,
      }),
    ];
    if (config.ENV !== 'dev') {
      plugins.push(strip({
        debugger: false,
        functions: [
          'console.log',
          'assert.*',
          'debug',
          'alert',
        ],
        sourceMap: false,
      }));
    }
    const bundle = await rollup({
      input,
      plugins,
    });

    const {output} = await bundle.generate({
      format: 'iife',
      indent: true,
      strict: false,
    });

    const codeParts = [];
    for (const chunkOrAsset of output) {
      if (chunkOrAsset.isAsset) {
        codeParts.push(chunkOrAsset.source);
      } else {
        codeParts.push(chunkOrAsset.code);
      }
    }
    info('Rollupified');

    const jsCode = codeParts.join('\n');

    if (config.ENV === 'dev') {
      return jsCode;
    }

    const minOutput = terser.minify(jsCode, {
      toplevel: true,
      output: {
        beautify: false,
      },
    });
    info('Minified');
    return minOutput.code;
  } catch (err) {
    error(err);
    return null;
  }
};

export default async (filePath) => {
  const config = getConfigs();
  const fullPath = normalize(filePath);
  if (!existsSync(fullPath)) {
    error(`File does not exist: ${fullPath}`);
    return null;
  }
  const jsContent = await rollupify(fullPath, config);
  return jsContent;
};
