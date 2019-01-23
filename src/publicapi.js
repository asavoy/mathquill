/*********************************************************
 * The publicly exposed MathQuill API.
 ********************************************************/

/**
 * Global function that takes an HTML element and, if it's the root HTML element
 * of a static math or math or text field, returns its API object (if not, null).
 * Identity of API object guaranteed if called multiple times, i.e.:
 *
 *   var mathfield = MathQuill.MathField(mathFieldSpan);
 *   assert(MathQuill(mathFieldSpan) === mathfield);
 *   assert(MathQuill(mathFieldSpan) === MathQuill(mathFieldSpan));
 *
 */
function MathQuill(el) {
  if (!el || !el.nodeType) return null; // check that `el` is a HTML element, using the
    // same technique as jQuery: https://github.com/jquery/jquery/blob/679536ee4b7a92ae64a5f58d90e9cc38c001e807/src/core/init.js#L92
  var blockId = $(el).children('.mq-root-block').attr(mqBlockId);
  return blockId ? Node.byId[blockId].controller.API : null;
};

/** MatHSPaCE HacK */
/* A helper method to get block by command id or block id */
MathQuill.getBlock = function(el) {
  if (!el || !el.nodeType) return null;
  var blockId = $(el).attr(mqCmdId) ||$(el).attr(mqBlockId);
  return blockId ? Node.byId[blockId]: null;
};


/**
 * Returns function (to be publicly exported) that MathQuill-ifies an HTML
 * element and returns an API object. If the element had already been MathQuill-
 * ified into the same kind, return the original API object (if different kind
 * or not an HTML element, null).
 */
function APIFnFor(APIClass) {
  function APIFn(el, opts) {
    var mq = MathQuill(el);
    if (mq instanceof APIClass || !el || !el.nodeType) return mq;
    return APIClass($(el), opts);
  }
  APIFn.prototype = APIClass.prototype;
  return APIFn;
}

var Options = P(), optionProcessors = {};
MathQuill.__options = Options.p;

var AbstractMathQuill = P(function(_) {
  _.init = function() { throw "wtf don't call me, I'm 'abstract'"; };
  _.initRoot = function(root, el, opts) {
    this.__options = Options();
    this.config(opts);

    var ctrlr = Controller(this, root, el);
    ctrlr.initializeLatexGrammar(); // copy the global latex grammar into the controller instance
    ctrlr.createTextarea();

    var contents = el.contents().detach();
    root.jQ =
      $('<span class="mq-root-block"/>').attr(mqBlockId, root.id).appendTo(el);
    this.latex(contents.text());

    this.revert = function() {
      return el.empty().unbind('.mathquill')
      .removeClass('mq-editable-field mq-math-mode mq-text-mode')
      .append(contents);
    };
  };
  _.config =
  MathQuill.config = function(opts) {
    for (var opt in opts) if (opts.hasOwnProperty(opt) && opts[opt] != null) {
      var optVal = opts[opt], processor = optionProcessors[opt];
      this.__options[opt] = (processor ? processor(optVal) : optVal);
    }
    return this;
  };
  _.el = function() { return this.__controller.container[0]; };
  _.text = function() { return this.__controller.exportText(); };
  _.latex = function(latex) {
    if (arguments.length > 0) {
      this.__controller.renderLatexMath(latex);
      if (this.__controller.blurred) this.__controller.cursor.hide().parent.blur();
      return this;
    }
    return this.__controller.exportLatex();
  };
  _.html = function() {
    return this.__controller.root.jQ.html()
      .replace(/ mathquill-(?:command|block)-id="?\d+"?/g, '')
      .replace(/<span class="?mq-cursor( mq-blink)?"?>.?<\/span>/i, '')
      .replace(/ mq-hasCursor|mq-hasCursor ?/, '')
      .replace(/ class=(""|(?= |>))/g, '');
  };
  _.reflow = function() {
    this.__controller.root.postOrder('reflow');
    return this;
  };
});
MathQuill.prototype = AbstractMathQuill.prototype;

MathQuill.StaticMath = APIFnFor(P(AbstractMathQuill, function(_, super_) {
  _.init = function(el, opts) {
    this.initRoot(MathBlock(), el.addClass('mq-math-mode'), opts);
    this.__controller.delegateMouseEvents();
    this.__controller.staticMathTextareaEvents();
  };
  _.latex = function() {
    var returned = super_.latex.apply(this, arguments);
    if (arguments.length > 0) {
      this.__controller.root.postOrder('registerInnerField', this.innerFields = []);
    }
    return returned;
  };
}));

var EditableField = MathQuill.EditableField = P(AbstractMathQuill, function(_) {
  _.initRootAndEvents = function(root, el, opts) {
    this.initRoot(root, el, opts);
    this.__controller.editable = true;
    this.__controller.delegateMouseEvents();
    this.__controller.editablesTextareaEvents();
  };
  _.focus = function() { this.getActiveNode().__controller.textarea.focus(); return this; };
  _.blur = function() { this.getActiveNode().__controller.textarea.blur(); return this; };
  _.getActiveNode = function () {
    /** MatHSPaCE HacK */
    // If nested editable box exists, all commands should
    // be executed against last focused editable box
    var rootBlocks = this.__controller.container.find('.mq-inner-editable .mq-root-block');
    if (rootBlocks.length) {
      var lastFocused = rootBlocks.filter('.mq-last-focused');
      // If there is no last focused box, focus on the first nested editable box
      var activeRoot = lastFocused.length ? lastFocused.eq(0) : rootBlocks.eq(0),
      activeNode =  Node.byId[activeRoot.attr(mqBlockId)];
      if (activeNode) {
        activeNode.__controller = activeNode.__controller || activeNode.controller;
        return activeNode;
      }
    } else {
      return this;
    }
  };
  _.write = function(latex) {
    var activeNode = this.getActiveNode();
    activeNode.__controller.writeLatex(latex);
    if (activeNode.__controller.blurred) activeNode.__controller.cursor.hide().parent.blur();
    return activeNode;
  };
  _.cmd = function(cmd) {
    var activeNode = this.getActiveNode();
    var ctrlr = activeNode.__controller.notify(), cursor = ctrlr.cursor;
    if (/^\\[a-z]+$/i.test(cmd)) {
      cmd = cmd.slice(1);
      var klass = LatexCmds[cmd];
      if (klass) {
        cmd = klass(cmd);
        if (cursor.selection) cmd.replaces(cursor.replaceSelection());
        cmd.createLeftOf(cursor.show());
      }
      else /* TODO: API needs better error reporting */;
    }
    else cursor.parent.write(cursor, cmd);
    if (ctrlr.blurred) cursor.hide().parent.blur();
    return this;
  };
  _.select = function() {
    var ctrlr = this.__controller;
    ctrlr.notify('move').cursor.insAtRightEnd(ctrlr.root);
    while (ctrlr.cursor[L]) ctrlr.selectLeft();
    return this;
  };
  _.clearSelection = function() {
    this.__controller.cursor.clearSelection();
    return this;
  };

  _.moveToDirEnd = function(dir) {
    this.__controller.notify('move').cursor.insAtDirEnd(dir, this.__controller.root);
    return this;
  };
  _.moveToLeftEnd = function() { return this.moveToDirEnd(L); };
  _.moveToRightEnd = function() { return this.moveToDirEnd(R); };

  _.keystroke = function(keys) {
    var activeNode = this.getActiveNode();
    var keys = keys.replace(/^\s+|\s+$/g, '').split(/\s+/);
    for (var i = 0; i < keys.length; i += 1) {
      activeNode.__controller.keystroke(keys[i], { preventDefault: noop });
    }
    return this;
  };
  _.typedText = function(text) {
    for (var i = 0; i < text.length; i += 1) this.getActiveNode().__controller.typedText(text.charAt(i));
    return this;
  };
});

function RootBlockMixin(_) {
  var names = 'moveOutOf deleteOutOf selectOutOf upOutOf downOutOf'.split(' ');
  for (var i = 0; i < names.length; i += 1) (function(name) {
    _[name] = function(dir) { this.controller.handle(name, dir); };
  }(names[i]));
  _.reflow = function() {
    this.controller.handle('reflow');
    this.controller.handle('edited');
    this.controller.handle('edit');
  };
}
