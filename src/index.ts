import { Compiler, Configuration } from 'webpack';

type File = {
  [key: string]: string
};

type Asset = {
  source(): string
  size(): number
};

interface Compilation {
  assets: { [key: string]: Asset }
}

interface Config {
  filter?(fileName: string): boolean
}

export default class Plugin
{ 
  static replaceLinkWithStyle(html: string, style: string, cssFileName: string) {
    return html.replace(
      new RegExp(`<link[^>]+href=['"]${cssFileName}['"][^>]+(>|\/>|><\/link>)`),
      `<style>${style}</style>`
      );
  }

  private config: Config;

  private css: File = {};

  private html: File = {};

  constructor(config: Config = {}) {
    this.config = config;
  }

  private filter(fileName: string): boolean {
    if (typeof this.config.filter === 'function') {
      return this.config.filter(fileName);
    } else {
      return true;
    }
  }

  private prepare({ assets }: Compilation) {
    const isCSS = is('css');
    const isHTML = is('html');

    Object.keys(assets).forEach((fileName) => {
      if (isCSS(fileName)) {
        const isCurrentFileNeedsToBeInlined = this.filter(fileName);
        if (isCurrentFileNeedsToBeInlined) {
          this.css[fileName] = assets[fileName].source();
          delete assets[fileName];
        }
      } else if (isHTML(fileName)) {
        this.html[fileName] = assets[fileName].source();
      }
    });
  }

  private process({ assets }: Compilation, { output }: Configuration) {
    const publicPath = (output && output.publicPath) || '';
    Object.keys(this.html).forEach((htmlFileName) => {
      let html = this.html[htmlFileName];

      Object.keys(this.css).forEach((key) => {
        html = Plugin.replaceLinkWithStyle(html, this.css[key], publicPath + key);
      });

      assets[htmlFileName] = {
        source() { return html },
        size() { return html.length },
      };
    });
  }

  apply(compiler: Compiler) {
    compiler.hooks.emit.tapAsync('html-inline-css-webpack-plugin', (compilation: Compilation, callback: () => void) => {
      this.prepare(compilation);
      this.process(compilation, compiler.options);
      callback();
    });
  }
}

function is(filenameExtension: string) {
  const reg = new RegExp(`\.${filenameExtension}$`);
  return (fileName: string) => reg.test(fileName);
}
