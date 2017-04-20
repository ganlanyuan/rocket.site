const gulp = require('gulp');
const $ = require('gulp-load-plugins')();
const browserSync = require('browser-sync').create();
const nunjucks = require('nunjucks');
const path = require('path');

let dev = false;
let sourcemapDest = '../sourcemaps';
let src = 'src/',
  assets = 'assets/',
  templates = 'templates/';
  
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
  gulp.watch([templates + 'code/*.yml'], function (e) {
    if (e.type !== 'deleted') {
      return gulp.src(e.path)
        .pipe($.plumber())
        .pipe($.yaml({space: 2}))
        .pipe(gulp.dest(templates + 'code'));
    }
  });

  // scss to njk
  gulp.watch([templates + 'code/scss/*.scss'], function (e) {
    if (e.type !== 'deleted') {
      return gulp.src(e.path)
        .pipe($.plumber())
        .pipe($.change(function(content) {
          return content.replace(/(\/\/=>\s+)/g, '').replace(/\@import\s\'.+\';/g, '');
        }))
        .pipe($.rename({extname: '.njk'}))
        .pipe(gulp.dest(templates + 'code'));
    }
  });

  // njk to html
  gulp.watch([templates + '*.njk', templates + 'code/*.json'], function (e) {
    if (e.type !== 'deleted') {
      let njkSrc = e.path, 
          data = {}, 
          pathData = path.parse(e.path), 
          fileDir = pathData.dir, 
          fileExt = pathData.ext,
          fileName = pathData.name;

      if (fileExt === '.json') {
        njkSrc = njkSrc.replace('/code', '').replace(fileExt, '.njk');
      }

      if (fileName !== 'index') {
        data = requireUncached('./' + templates + 'code/' + fileName + '.json');
      }

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

      return gulp.src(njkSrc)
        .pipe($.plumber())
        .pipe($.nunjucks.compile(data, {
          watch: true,
          noCache: true,
        }))
        .pipe($.rename(function (path) { path.extname = ".html"; }))
        .pipe($.if(dev, $.htmltidy({
          doctype: 'html5',
          wrap: 0,
          hideComments: true,
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
          removeComments: true,
        })))
        .pipe(gulp.dest('.'));
    }
  });

  // scss to css
  gulp.watch(['**/*.scss'], function (e) {
    if (e.type !== 'deleted') {
      let sassSrc = src + 'scss/main.scss', 
          dest = assets + 'css',
          pathData = path.parse(e.path), 
          dir = pathData.dir,
          name = pathData.name;

      if (dir.indexOf('video') !== -1 || dir.indexOf('templates/') !== -1) { sassSrc = e.path; }
      if (dir.indexOf('video') !== -1) { dest += '/video'; }

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