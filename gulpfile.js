const gulp = require('gulp');
const $ = require('gulp-load-plugins')();
const browserSync = require('browser-sync').create();
const nunjucks = require('nunjucks');
const path = require('path');

let dev = false;
let sourcemapDest = '../sourcemaps';
let src = 'src/',
  assets = 'assets/',
  templates = '**/templates/';
  
let NAMES = {
  cssMain: 'main.css',
  svgSprites: 'sprites.svg',
};

function errorlog (error) {  
  console.error.bind(error);  
  this.emit('end');  
}  
function requireUncached( $module ) {
  delete require.cache[require.resolve( $module )];
  return require( $module );
}

// Inject Task
gulp.task('inject', function () {
  let svg4everybody = gulp.src('bower_components/svg4everybody/dist/svg4everybody.legacy.min.js')
      .pipe($.uglify());

  return gulp.src(templates + 'parts/layout.njk')
      .pipe($.inject(svg4everybody, {
        starttag: '/* svg4everybody:js */',
        endtag: '/* endinject */',
        transform: function (filePath, file) {
          return file.contents.toString().replace('height:100%;width:100%', '');
        }
      }))
      .pipe(gulp.dest(templates + 'parts'));
});

// Server & Watch Tasks
gulp.task('server', function() {
  browserSync.init({
    server: {
      baseDir: './'
    },
    open: false,
    notify: false
  });

  // yml to json
  gulp.watch([templates + '**/*.yml'], function (e) {
    if (e.type !== 'deleted') {
      return gulp.src(e.path)
        .pipe($.plumber())
        .pipe($.yaml({space: 2}))
        .pipe(gulp.dest(path.dirname(e.path)));
    }
  });

  // scss to njk
  gulp.watch([templates + '**/*.scss'], function (e) {
    if (e.type !== 'deleted') {
      return gulp.src(e.path)
        .pipe($.plumber())
        .pipe($.change(function(content) {
          return content.replace(/(\/\/=>\s+)/g, '').replace(/\@import\s\'.+\';/g, '');
        }))
        .pipe($.rename(function (path) { 
          path.basename = path.basename.replace('_', ''); 
          path.extname = ".njk"; 
        }))
        .pipe(gulp.dest(path.dirname(e.path)));
    }
  });

  // scss to css
  gulp.watch(['**/*.scss'], function (e) {
    if (e.type !== 'deleted') {
      let fpath = e.path,
          pathData = path.parse(fpath), 
          dir = pathData.dir,
          sassSrc = src + 'scss/main.scss', 
          version = (dir.indexOf('v3/') !== -1) ? '/v3' : (dir.indexOf('v4/') !== -1) ? '/v4' : '',
          dest = assets + 'css' + version;

      if (dir.indexOf('video') !== -1 || dir.indexOf('templates/') !== -1) { 
        sassSrc = fpath; 
      }
      if (dir.indexOf('video') !== -1) { 
        dest += '/video'; 
      }

      return gulp.src(sassSrc)  
        .pipe($.plumber())
        .pipe($.if(dev, $.sourcemaps.init()))
        .pipe($.sass({
          outputStyle: 'expanded', 
          precision: 7
        }).on('error', $.sass.logError))  
        .pipe($.if(dev, $.sourcemaps.write(sourcemapDest)))
        .pipe(gulp.dest(dest));
    }
  });

  // njk to html
  gulp.watch(['index.njk', templates + '*.njk', templates + '*.json'], function (e) {
    if (e.type !== 'deleted' && e.path.indexOf('parts') === -1) {
      let pathData = path.parse(e.path),
          fileDir = pathData.dir, 
          fileName = pathData.name,
          fileNameUpdated = (fileName.indexOf('-') === -1) ? fileName : fileName.replace('_', '').slice(0, fileName.indexOf('-')),
          njkSrc = fileDir + '/' + fileNameUpdated + '.njk',
          version = (fileDir.indexOf('v3') !== -1) ? 'v3' : (fileDir.indexOf('v4') !== -1) ? 'v4' : '';

      let data = (fileName !== 'index') ? requireUncached('./' + version + '/templates/' + fileNameUpdated + '.json') : {};

      data.is = function (type, obj) {
        var clas = Object.prototype.toString.call(obj).slice(8, -1);
        return obj !== undefined && obj !== null && clas === type;
      };
      data.keys = function (obj) {
        return Object.keys(obj);
      };
      data.belongTo = function (str, arr) {
        return arr.indexOf(str) !== -1;
      };
      data.version = version;
      data.page = fileNameUpdated;

      return gulp.src(njkSrc)
        .pipe($.plumber())
        .pipe($.nunjucks.compile(data, {
          watch: true,
          noCache: true,
        }))
        .pipe($.rename(function (path) { 
          path.filename = fileNameUpdated; 
          path.extname = ".html"; 
        }))
        .pipe($.if(dev, $.htmltidy({
          doctype: 'html5',
          wrap: 0,
          hideComments: false,
          indent: true,
          'indent-attributes': false,
          'drop-empty-elements': false,
          'force-output': true
        }), $.htmlmin({
          collapseWhitespace: true,
          collapseInlineTagWhitespace: true,
          collapseBooleanAttributes: true,
          decodeEntities: true,
          minifyCSS: true,
          minifyJs: true,
          removeComments: false,
        })))
        .pipe(gulp.dest('./' + version));
    }
  });

  // svg-sprites 
  gulp.watch(src + 'svg/sprites/*.svg', function (e) {
    if (e.type !== 'deleted') {
      return gulp.src(src + 'svg/sprites/*.svg')
        .pipe($.svgmin(function (file) {
          let prefix = path.basename(file.relative, path.extname(file.relative));
          return {
            plugins: [{
              cleanupIDs: {
                prefix: prefix + '-',
                minify: true
              }
            }],
            // js2svg: { pretty: true }
          }
        }))
        .pipe($.svgstore({ inlineSvg: true }))
        .pipe($.rename(NAMES.svgSprites))
        .pipe(gulp.dest(assets + 'svg'));
    }
  });

  // reload
  gulp.watch(['**/*.html', '**/css/*.css', '**/js/*.js']).on('change', browserSync.reload);
});

// Default Task
gulp.task('default', [
  // 'inject',
  'server', 
]);  