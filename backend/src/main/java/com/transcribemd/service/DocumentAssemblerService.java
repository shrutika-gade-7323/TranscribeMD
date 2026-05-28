package com.transcribemd.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.transcribemd.entity.Image;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.util.Units;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.*;
import org.springframework.stereotype.Service;

import java.io.*;
import java.math.BigInteger;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@Service
@Slf4j
@RequiredArgsConstructor
public class DocumentAssemblerService {

    private final ObjectMapper objectMapper;
    private final StorageService storageService;

    public byte[] assemble(String annotatedJson, String templateKey, List<Image> images) {
        log.info("Assembling document from annotated JSON");

        try {
            JsonNode root = objectMapper.readTree(annotatedJson);
            Map<Integer, Image> imageMap = buildImageMap(images);

            XWPFDocument doc;

            // Load template or create blank document
            if (templateKey != null && storageService.exists(templateKey)) {
                try (InputStream templateStream = storageService.retrieve(templateKey)) {
                    doc = new XWPFDocument(templateStream);
                    injectIntoTemplate(doc, root, imageMap);
                }
            } else {
                doc = new XWPFDocument();
                buildFromScratch(doc, root, imageMap);
            }

            ByteArrayOutputStream out = new ByteArrayOutputStream();
            doc.write(out);
            doc.close();
            log.info("Document assembled successfully ({} bytes)", out.size());
            return out.toByteArray();

        } catch (Exception e) {
            log.error("Document assembly failed: {}", e.getMessage(), e);
            throw new RuntimeException("Document assembly failed: " + e.getMessage(), e);
        }
    }

    private void injectIntoTemplate(XWPFDocument doc, JsonNode root, Map<Integer, Image> imageMap) throws Exception {
        // Replace patient placeholders in existing template paragraphs
        JsonNode patient = root.path("patient");
        replacePlaceholders(doc, patient);

        // Find {{REPORT_BODY}} anchor and insert content there
        XWPFParagraph bodyAnchor = findAndRemoveAnchor(doc, "{{REPORT_BODY}}");
        if (bodyAnchor != null) {
            int insertIndex = doc.getParagraphs().indexOf(bodyAnchor);
            insertSections(doc, root.path("sections"), imageMap, insertIndex);
        } else {
            // Append at end
            insertSections(doc, root.path("sections"), imageMap, -1);
        }
    }

    private void buildFromScratch(XWPFDocument doc, JsonNode root, Map<Integer, Image> imageMap) throws Exception {
        // Set page margins
        CTSectPr sectPr = doc.getDocument().getBody().addNewSectPr();
        CTPageMar pageMar = sectPr.addNewPgMar();
        pageMar.setTop(BigInteger.valueOf(1440)); // 1 inch
        pageMar.setBottom(BigInteger.valueOf(1440));
        pageMar.setLeft(BigInteger.valueOf(1440));
        pageMar.setRight(BigInteger.valueOf(1440));

        // Patient header if available
        JsonNode patient = root.path("patient");
        if (!patient.path("name").isMissingNode() && !patient.path("name").isNull()) {
            addPatientHeader(doc, patient);
        }

        insertSections(doc, root.path("sections"), imageMap, -1);
    }

    private void addPatientHeader(XWPFDocument doc, JsonNode patient) {
        XWPFParagraph headerPara = doc.createParagraph();
        headerPara.setAlignment(ParagraphAlignment.LEFT);

        String patientName = patient.path("name").asText("");
        String mrn = patient.path("mrn").asText("");
        String procedure = patient.path("procedure").asText("");

        if (!patientName.isEmpty()) addRun(headerPara, "Patient: " + patientName, true, false, false, 12);
        if (!mrn.isEmpty()) addRun(doc.createParagraph(), "MRN: " + mrn, false, false, false, 12);
        if (!procedure.isEmpty()) addRun(doc.createParagraph(), "Procedure: " + procedure, false, false, false, 12);

        // Separator line
        XWPFParagraph sep = doc.createParagraph();
        addRun(sep, "─".repeat(60), false, false, false, 12);
        doc.createParagraph(); // blank line
    }

    private void insertSections(XWPFDocument doc, JsonNode sections, Map<Integer, Image> imageMap, int startIndex) throws Exception {
        if (sections.isMissingNode() || !sections.isArray()) return;

        for (JsonNode section : sections) {
            // Section heading
            String heading = section.path("heading").asText("");
            JsonNode headingFormat = section.path("headingFormat");

            if (!heading.isEmpty()) {
                XWPFParagraph headingPara = doc.createParagraph();
                headingPara.setAlignment(getAlignment(headingFormat.path("alignment").asText("LEFT")));
                headingPara.setSpacingAfter(100);

                boolean hBold = headingFormat.path("bold").asBoolean(true);
                boolean hUnderline = headingFormat.path("underline").asBoolean(false);
                boolean hAllCaps = headingFormat.path("allCaps").asBoolean(true);

                String displayHeading = hAllCaps ? heading.toUpperCase() : heading;
                addRun(headingPara, displayHeading, hBold, false, hUnderline, 12);
            }

            // Section items
            JsonNode items = section.path("items");
            String listStyle = section.path("listStyle").asText("NONE");
            JsonNode bodyFormat = section.path("bodyFormat");
            ParagraphAlignment bodyAlignment = getAlignment(bodyFormat.path("alignment").asText("LEFT"));
            int fontSize = bodyFormat.path("fontSize").asInt(12);
            String fontFamily = bodyFormat.path("fontFamily").asText("Times New Roman");
            int itemNumber = 1;

            for (JsonNode item : items) {
                XWPFParagraph para = doc.createParagraph();
                para.setAlignment(bodyAlignment);
                para.setIndentationLeft(0);

                // Build runs
                JsonNode runs = item.path("runs");
                int runIdx = 0;
                for (JsonNode run : runs) {
                    String text = run.path("text").asText("");
                    JsonNode fmt = run.path("format");
                    boolean bold = fmt.path("bold").asBoolean(false);
                    boolean italic = fmt.path("italic").asBoolean(false);
                    boolean underline = fmt.path("underline").asBoolean(false);
                    boolean allCaps = fmt.path("allCaps").asBoolean(false);

                    // Prepend list marker to first run
                    if (!text.isEmpty() && runIdx == 0) {
                        if ("NUMBERED".equals(listStyle)) {
                            text = itemNumber + ". " + text;
                        } else if ("BULLETED".equals(listStyle)) {
                            text = "• " + text;
                        }
                    }

                    String displayText = allCaps ? text.toUpperCase() : text;
                    XWPFRun r = addRun(para, displayText, bold, italic, underline, fontSize);
                    r.setFontFamily(fontFamily);
                    runIdx++;
                }

                // Insert image after this paragraph if referenced
                JsonNode imageRef = item.path("imageRef");
                if (!imageRef.isMissingNode()) {
                    String imageIdStr = imageRef.path("imageId").asText("");
                    String caption = imageRef.path("anchorText").asText("");
                    int imgNum = parseImageNumber(imageIdStr);
                    Image img = imageMap.get(imgNum);
                    if (img != null) {
                        insertImage(doc, img, caption);
                    }
                }

                itemNumber++;
            }

            // Add spacing after section
            doc.createParagraph();
        }
    }

    private XWPFRun addRun(XWPFParagraph para, String text, boolean bold, boolean italic, boolean underline, int fontSize) {
        XWPFRun run = para.createRun();
        run.setText(text);
        run.setBold(bold);
        run.setItalic(italic);
        if (underline) run.setUnderline(UnderlinePatterns.SINGLE);
        run.setFontSize(fontSize);
        run.setFontFamily("Times New Roman");
        return run;
    }

    private void insertImage(XWPFDocument doc, Image img, String caption) {
        try (InputStream imgStream = storageService.retrieve(img.getFileKey())) {
            XWPFParagraph imgPara = doc.createParagraph();
            imgPara.setAlignment(ParagraphAlignment.CENTER);
            XWPFRun imgRun = imgPara.createRun();

            int pictureType = getPictureType(img.getMimeType());
            int width = Units.toEMU(400); // 400 points ≈ 5.5 inches
            int height = Units.toEMU(300);
            imgRun.addPicture(imgStream, pictureType, img.getFileName(), width, height);

            if (caption != null && !caption.isEmpty()) {
                XWPFParagraph captionPara = doc.createParagraph();
                captionPara.setAlignment(ParagraphAlignment.CENTER);
                XWPFRun captionRun = captionPara.createRun();
                captionRun.setText("Figure " + img.getSequenceNumber() + ": " + caption);
                captionRun.setItalic(true);
                captionRun.setFontSize(10);
            }
        } catch (Exception e) {
            log.warn("Could not insert image {}: {}", img.getId(), e.getMessage());
        }
    }

    private int getPictureType(String mimeType) {
        if (mimeType == null) return XWPFDocument.PICTURE_TYPE_PNG;
        return switch (mimeType.toLowerCase()) {
            case "image/jpeg", "image/jpg" -> XWPFDocument.PICTURE_TYPE_JPEG;
            case "image/gif" -> XWPFDocument.PICTURE_TYPE_GIF;
            case "image/tiff" -> XWPFDocument.PICTURE_TYPE_TIFF;
            default -> XWPFDocument.PICTURE_TYPE_PNG;
        };
    }

    private ParagraphAlignment getAlignment(String alignment) {
        return switch (alignment.toUpperCase()) {
            case "CENTER" -> ParagraphAlignment.CENTER;
            case "RIGHT" -> ParagraphAlignment.RIGHT;
            case "JUSTIFY" -> ParagraphAlignment.BOTH;
            default -> ParagraphAlignment.LEFT;
        };
    }

    private Map<Integer, Image> buildImageMap(List<Image> images) {
        Map<Integer, Image> map = new java.util.HashMap<>();
        if (images != null) {
            for (Image img : images) {
                map.put(img.getSequenceNumber(), img);
            }
        }
        return map;
    }

    private int parseImageNumber(String imageId) {
        // Handles "img_2", "image_2", "2", etc.
        try {
            return Integer.parseInt(imageId.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            return -1;
        }
    }

    private void replacePlaceholders(XWPFDocument doc, JsonNode patient) {
        String name = patient.path("name").asText("");
        String mrn = patient.path("mrn").asText("");
        String dob = patient.path("dob").asText("");

        for (XWPFParagraph para : doc.getParagraphs()) {
            for (XWPFRun run : para.getRuns()) {
                String text = run.getText(0);
                if (text != null) {
                    text = text.replace("{{PATIENT_NAME}}", name.isEmpty() ? "[Patient Name]" : name);
                    text = text.replace("{{PATIENT_MRN}}", mrn.isEmpty() ? "[MRN]" : mrn);
                    text = text.replace("{{PATIENT_DOB}}", dob.isEmpty() ? "[DOB]" : dob);
                    run.setText(text, 0);
                }
            }
        }

        // Also check tables
        for (XWPFTable table : doc.getTables()) {
            for (XWPFTableRow row : table.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    for (XWPFParagraph para : cell.getParagraphs()) {
                        for (XWPFRun run : para.getRuns()) {
                            String text = run.getText(0);
                            if (text != null) {
                                text = text.replace("{{PATIENT_NAME}}", name.isEmpty() ? "[Patient Name]" : name);
                                text = text.replace("{{PATIENT_MRN}}", mrn.isEmpty() ? "[MRN]" : mrn);
                                text = text.replace("{{PATIENT_DOB}}", dob.isEmpty() ? "[DOB]" : dob);
                                run.setText(text, 0);
                            }
                        }
                    }
                }
            }
        }
    }

    private XWPFParagraph findAndRemoveAnchor(XWPFDocument doc, String anchor) {
        for (XWPFParagraph para : doc.getParagraphs()) {
            if (para.getText().contains(anchor)) {
                // Clear the anchor text
                for (XWPFRun run : para.getRuns()) {
                    run.setText("", 0);
                }
                return para;
            }
        }
        return null;
    }
}
