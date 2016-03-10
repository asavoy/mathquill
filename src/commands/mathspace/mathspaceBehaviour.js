// Add old editable support

LatexCmds.editable = P(LatexCmds.MathQuillMathField, function(_, super_) {
  _.ctrlSeq = '\\editable';
  // Fix the latex output so it contains "\editable {}"
  _.latex = function(){ return '\\editable{' + this.ends[L].latex() + '}'};
});


// Add extra space after comma

LatexCmds.comma = LatexCmds[','] = P(Symbol, function(_, super_) {
  _.init = function(ctrlSeq, html, text) {
    super_.init.call(this,
      ctrlSeq, '<span class="mq-comma">,</span>', text
    );
  };
});


// integral
// We added placeholder support for integral 
LatexCmds['∫'] =
LatexCmds['int'] =
LatexCmds.integral = P(MathCommand, function(_, super_) {
  _.ctrlSeq = '\\int';
  _.init = function() {
    var htmlTemplate =
      '<span>' +
        '<big>∫</big>' +
        '<span class="mq-supsub mq-non-leaf mq-int">' +
          '<span class="mq-sup">&0</span>' +
          '<span class="mq-sub">&1</span>' +
        '</span>' +
      '</span>'
    ;
    Symbol.prototype.init.call(this, '\\int ', htmlTemplate);
  };
  _.latex = function() {
    var b = this.blocks;
    return this.ctrlSeq + '{' + b[0].latex() +'}{' + b[1].latex() + '}';
  };
});